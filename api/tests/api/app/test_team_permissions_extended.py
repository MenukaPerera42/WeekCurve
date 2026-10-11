from uuid import NAMESPACE_URL, uuid5

import pytest
from sqlalchemy import select

from app.models import Organization, OrganizationMembership, Team, TeamMembership, User
from app.security import JWT_AUDIENCE_APP, generate_jwt_token, hash_password

ORIGIN = {"origin": "http://localhost:3001"}


def as_user(client, user_id):
    client.cookies.clear()
    client.cookies.set(
        "access_token",
        f"Bearer {generate_jwt_token({'sub': str(user_id)}, JWT_AUDIENCE_APP)}",
    )


@pytest.fixture
async def team_case(session_factory, request):
    suffix = uuid5(NAMESPACE_URL, request.node.name).hex
    async with session_factory() as db:
        owner_a = User(
            first_name="A", last_name="Owner",
            email=f"team-owner-a-{suffix}@test.dev",
            password=hash_password("long-test-password"),
            is_active=True, is_admin=False,
        )
        admin_a = User(
            first_name="A", last_name="Admin",
            email=f"team-admin-a-{suffix}@test.dev",
            password=hash_password("long-test-password"),
            is_active=True, is_admin=False,
        )
        lead_a = User(
            first_name="A", last_name="Lead",
            email=f"team-lead-a-{suffix}@test.dev",
            password=hash_password("long-test-password"),
            is_active=True, is_admin=False,
        )
        member_a = User(
            first_name="A", last_name="Member",
            email=f"team-member-a-{suffix}@test.dev",
            password=hash_password("long-test-password"),
            is_active=True, is_admin=False,
        )
        owner_b = User(
            first_name="B", last_name="Owner",
            email=f"team-owner-b-{suffix}@test.dev",
            password=hash_password("long-test-password"),
            is_active=True, is_admin=False,
        )
        db.add_all([owner_a, admin_a, lead_a, member_a, owner_b])
        await db.flush()
        org_a = Organization(name="Team Org A", slug=f"team-org-a-{suffix}")
        org_b = Organization(name="Team Org B", slug=f"team-org-b-{suffix}")
        db.add_all([org_a, org_b])
        await db.flush()
        owner_a_m = OrganizationMembership(
            organization_id=org_a.id, user_id=owner_a.id, role="owner"
        )
        admin_a_m = OrganizationMembership(
            organization_id=org_a.id, user_id=admin_a.id, role="admin"
        )
        lead_a_m = OrganizationMembership(
            organization_id=org_a.id, user_id=lead_a.id, role="member"
        )
        member_a_m = OrganizationMembership(
            organization_id=org_a.id, user_id=member_a.id, role="member"
        )
        owner_b_m = OrganizationMembership(
            organization_id=org_b.id, user_id=owner_b.id, role="owner"
        )
        db.add_all([owner_a_m, admin_a_m, lead_a_m, member_a_m, owner_b_m])
        await db.flush()
        team_a = Team(organization_id=org_a.id, name="Engineering A")
        team_b = Team(organization_id=org_b.id, name="Engineering B")
        db.add_all([team_a, team_b])
        await db.flush()
        db.add_all([
            TeamMembership(
                organization_id=org_a.id, team_id=team_a.id,
                membership_id=lead_a_m.id, is_primary=True, is_lead=True,
            ),
            TeamMembership(
                organization_id=org_a.id, team_id=team_a.id,
                membership_id=member_a_m.id, is_primary=True, is_lead=False,
            ),
            TeamMembership(
                organization_id=org_b.id, team_id=team_b.id,
                membership_id=owner_b_m.id, is_primary=True, is_lead=True,
            ),
        ])
        await db.commit()
        return {
            "org_a": org_a.id, "org_b": org_b.id,
            "owner_a": owner_a.id, "admin_a": admin_a.id,
            "lead_a": lead_a.id, "member_a": member_a.id,
            "owner_b": owner_b.id, "lead_a_m": lead_a_m.id,
            "member_a_m": member_a_m.id, "owner_b_m": owner_b_m.id,
            "team_a": team_a.id, "team_b": team_b.id,
        }


@pytest.mark.asyncio
async def test_owner_and_admin_manage_teams_but_member_cannot(
    async_client, session_factory, team_case
):
    case = team_case
    teams_url = f"/app/organizations/{case['org_a']}/teams"
    as_user(async_client, case["admin_a"])
    created = await async_client.post(
        teams_url, headers=ORIGIN, json={"name": "Delivery"}
    )
    assert created.status_code == 201, created.text
    team_id = created.json()["id"]
    renamed = await async_client.patch(
        f"{teams_url}/{team_id}", headers=ORIGIN,
        json={"name": "Product Delivery"},
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Product Delivery"
    as_user(async_client, case["owner_a"])
    owner_created = await async_client.post(
        teams_url, headers=ORIGIN, json={"name": "Growth"}
    )
    assert owner_created.status_code == 201, owner_created.text
    as_user(async_client, case["member_a"])
    denied_create = await async_client.post(
        teams_url, headers=ORIGIN, json={"name": "Unauthorized"}
    )
    denied_rename = await async_client.patch(
        f"{teams_url}/{team_id}", headers=ORIGIN,
        json={"name": "Unauthorized Rename"},
    )
    assert denied_create.status_code == 403
    assert denied_rename.status_code == 403
    async with session_factory() as db:
        names = (await db.scalars(select(Team.name).where(
            Team.organization_id == case["org_a"]
        ))).all()
        assert set(names) == {"Engineering A", "Product Delivery", "Growth"}


@pytest.mark.asyncio
async def test_guessed_foreign_team_ids_cannot_be_read_or_modified(
    async_client, session_factory, team_case
):
    case = team_case
    as_user(async_client, case["owner_a"])
    foreign_list = await async_client.get(
        f"/app/organizations/{case['org_b']}/teams"
    )
    foreign_members = await async_client.get(
        f"/app/organizations/{case['org_a']}/teams/{case['team_b']}/members"
    )
    foreign_patch = await async_client.patch(
        f"/app/organizations/{case['org_a']}/teams/{case['team_b']}",
        headers=ORIGIN, json={"name": "Changed by A"},
    )
    foreign_remove = await async_client.delete(
        f"/app/organizations/{case['org_a']}/teams/{case['team_b']}/members/{case['owner_b_m']}",
        headers=ORIGIN,
    )
    assert foreign_list.status_code == 404
    assert foreign_members.status_code == 404
    assert foreign_patch.status_code == 404
    assert foreign_remove.status_code == 404
    async with session_factory() as db:
        team = await db.get(Team, case["team_b"])
        membership = await db.scalar(select(TeamMembership).where(
            TeamMembership.team_id == case["team_b"],
            TeamMembership.membership_id == case["owner_b_m"],
        ))
        assert team is not None and team.name == "Engineering B"
        assert membership is not None and membership.is_lead is True


@pytest.mark.asyncio
async def test_only_org_administrators_can_replace_team_lead(
    async_client, session_factory, team_case
):
    case = team_case
    lead_url = (
        f"/app/organizations/{case['org_a']}/teams/{case['team_a']}"
        f"/lead/{case['member_a_m']}"
    )
    as_user(async_client, case["member_a"])
    assert (await async_client.put(lead_url, headers=ORIGIN)).status_code == 403
    as_user(async_client, case["lead_a"])
    assert (await async_client.put(lead_url, headers=ORIGIN)).status_code == 403
    async with session_factory() as db:
        original = await db.scalar(select(TeamMembership).where(
            TeamMembership.team_id == case["team_a"],
            TeamMembership.membership_id == case["lead_a_m"],
        ))
        assert original is not None and original.is_lead is True
    as_user(async_client, case["admin_a"])
    changed = await async_client.put(lead_url, headers=ORIGIN)
    assert changed.status_code == 200, changed.text
    assert changed.json()["lead_member_id"] == str(case["member_a_m"])
    foreign_target = await async_client.put(
        f"/app/organizations/{case['org_a']}/teams/{case['team_a']}/lead/{case['owner_b_m']}",
        headers=ORIGIN,
    )
    assert foreign_target.status_code == 404
    async with session_factory() as db:
        rows = (await db.scalars(select(TeamMembership).where(
            TeamMembership.team_id == case["team_a"]
        ))).all()
        assert {row.membership_id for row in rows if row.is_lead} == {
            case["member_a_m"]
        }


@pytest.mark.asyncio
async def test_member_can_join_multiple_teams_with_one_primary(
    async_client, session_factory, team_case
):
    case = team_case
    as_user(async_client, case["admin_a"])
    created = await async_client.post(
        f"/app/organizations/{case['org_a']}/teams",
        headers=ORIGIN, json={"name": "Platform"},
    )
    assert created.status_code == 201, created.text
    team_id = created.json()["id"]
    members_url = f"/app/organizations/{case['org_a']}/teams/{team_id}/members"
    added = await async_client.post(
        members_url, headers=ORIGIN,
        json={"member_id": str(case["member_a_m"]), "is_primary": False},
    )
    assert added.status_code == 201, added.text
    assert added.json()["is_primary"] is False
    duplicate = await async_client.post(
        members_url, headers=ORIGIN,
        json={"member_id": str(case["member_a_m"]), "is_primary": False},
    )
    assert duplicate.status_code == 409
    primary = await async_client.put(
        f"/app/organizations/{case['org_a']}/teams/{team_id}/primary/{case['member_a_m']}",
        headers=ORIGIN,
    )
    assert primary.status_code == 200, primary.text
    assert primary.json()["is_primary"] is True
    async with session_factory() as db:
        rows = (await db.scalars(select(TeamMembership).where(
            TeamMembership.membership_id == case["member_a_m"]
        ))).all()
        assert len(rows) == 2
        assert {row.organization_id for row in rows} == {case["org_a"]}
        assert {str(row.team_id) for row in rows} == {
            str(case["team_a"]),
            str(team_id),
        }
        assert {str(row.team_id) for row in rows if row.is_primary} == {str(team_id)}


@pytest.mark.asyncio
async def test_removing_nonprimary_lead_revokes_current_team_authority(
    async_client, session_factory, team_case
):
    case = team_case
    as_user(async_client, case["admin_a"])
    created = await async_client.post(
        f"/app/organizations/{case['org_a']}/teams",
        headers=ORIGIN, json={"name": "Release"},
    )
    assert created.status_code == 201, created.text
    team_id = created.json()["id"]
    member_url = (
        f"/app/organizations/{case['org_a']}/teams/{team_id}"
        f"/members/{case['lead_a_m']}"
    )
    added = await async_client.post(
        f"/app/organizations/{case['org_a']}/teams/{team_id}/members",
        headers=ORIGIN,
        json={"member_id": str(case["lead_a_m"]), "is_primary": False},
    )
    assert added.status_code == 201, added.text
    assigned = await async_client.put(
        f"/app/organizations/{case['org_a']}/teams/{team_id}/lead/{case['lead_a_m']}",
        headers=ORIGIN,
    )
    assert assigned.status_code == 200, assigned.text
    week_url = (
        f"/app/organizations/{case['org_a']}/teams/{team_id}/weeks/2026-10-05"
    )
    as_user(async_client, case["lead_a"])
    assert (await async_client.get(week_url)).status_code == 200
    assert (await async_client.delete(member_url, headers=ORIGIN)).status_code == 403
    as_user(async_client, case["member_a"])
    assert (await async_client.delete(member_url, headers=ORIGIN)).status_code == 403
    as_user(async_client, case["admin_a"])
    removed = await async_client.delete(member_url, headers=ORIGIN)
    assert removed.status_code == 204, removed.text
    as_user(async_client, case["lead_a"])
    assert (await async_client.get(week_url)).status_code == 404
    async with session_factory() as db:
        removed_row = await db.scalar(select(TeamMembership).where(
            TeamMembership.team_id == team_id,
            TeamMembership.membership_id == case["lead_a_m"],
        ))
        original_row = await db.scalar(select(TeamMembership).where(
            TeamMembership.team_id == case["team_a"],
            TeamMembership.membership_id == case["lead_a_m"],
        ))
        assert removed_row is None
        assert original_row is not None and original_row.is_primary is True
