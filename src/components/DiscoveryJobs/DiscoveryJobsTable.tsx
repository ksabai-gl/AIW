import React from "react";
import { useDiscoveryJobsQuery } from "../../hooks/useDiscoveryJobsQuery";
import { DiscoveryJobRow } from "./DiscoveryJobRow";
import { TableSkeleton } from "../common/TableSkeleton";
import { ErrorState } from "../common/ErrorState";
import { EmptyState } from "../common/EmptyState";

/**
 * Discovery Jobs table.
 *
 * Fix for SCRUM-91: previously this component mapped directly over
 * `jobsQuery.data` (falling back to an empty array on failure), so a
 * failed API request rendered as an empty table with no indication
 * anything went wrong. This version explicitly checks `isLoading` and
 * `isError` before rendering rows, mirroring the error-state pattern
 * already used by the Dashboard KPI cards.
 */
export function DiscoveryJobsTable() {
  const jobsQuery = useDiscoveryJobsQuery();

  if (jobsQuery.isLoading) {
    return <TableSkeleton rows={5} />;
  }

  if (jobsQuery.isError) {
    return (
      <ErrorState
        title="Failed to load discovery jobs"
        message={jobsQuery.error?.message ?? "Please retry or contact support."}
        onRetry={() => jobsQuery.refetch()}
      />
    );
  }

  const rows = jobsQuery.data ?? [];

  if (rows.length === 0) {
    return <EmptyState message="No discovery jobs found." />;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Job</th>
          <th>Status</th>
          <th>Started</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((job) => (
          <DiscoveryJobRow key={job.id} job={job} />
        ))}
      </tbody>
    </table>
  );
}

export default DiscoveryJobsTable;
