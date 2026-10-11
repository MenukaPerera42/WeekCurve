from fastapi.routing import APIRouter

from .routers import ai, meta, plans, teams, users, workspaces

router = APIRouter()

router.include_router(meta.router)
router.include_router(users.router)
router.include_router(workspaces.router)
router.include_router(teams.router)
router.include_router(plans.router)
router.include_router(ai.router)
