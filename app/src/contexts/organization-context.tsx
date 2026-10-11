import { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListOrganizations } from "@/api/endpoints/organizations/organizations";
import type { OrganizationResponse } from "@/api/model";

type OrganizationContextValue = {
  organization: OrganizationResponse | null;
  organizations: OrganizationResponse[];
  isLoading: boolean;
  isError: boolean;
  selectOrganization: (id: string) => void;
};

const OrganizationContext = createContext<OrganizationContextValue | null>(
  null
);

export function OrganizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useListOrganizations();
  const [selectedId, setSelectedId] = useState(() =>
    localStorage.getItem("weekcurve.organization")
  );
  const organizations = data ?? [];
  const organization =
    organizations.find((o) => o.id === selectedId) ?? organizations[0] ?? null;

  useEffect(() => {
    if (organization && organization.id !== selectedId) {
      localStorage.setItem("weekcurve.organization", organization.id);
    }
  }, [organization, selectedId]);

  function selectOrganization(id: string) {
    if (!organizations.some((o) => o.id === id)) {
      return;
    }
    localStorage.setItem("weekcurve.organization", id);
    setSelectedId(id);
    queryClient.removeQueries({
      predicate: (query) =>
        query.queryKey.some(
          (part) => typeof part === "string" && part.includes("/organizations/")
        ),
    });
  }

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizations,
        isLoading,
        isError,
        selectOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization requires OrganizationProvider");
  }
  return context;
}
