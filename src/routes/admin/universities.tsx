import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TableWrap, LoadingRows } from "@/components/common";
import { useData } from "@/lib/useData";
import { getUniversities } from "@/services";

export const Route = createFileRoute("/admin/universities")({
  component: AdminUniversities,
});

function AdminUniversities() {
  const uniQ = useData(["universities"], getUniversities);

  return (
    <div>
      <PageHeader title="Universities" subtitle="Partner institutions in the demo catalog." />
      {uniQ.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th>Name</th>
              <th>Country</th>
              <th>City</th>
              <th>Levels</th>
              <th>Ranking</th>
              <th>Scholarships</th>
            </tr>
          </thead>
          <tbody>
            {(uniQ.data ?? []).map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-navy">{u.name}</td>
                <td>{u.country}</td>
                <td>{u.city}</td>
                <td className="text-xs">{u.levels.join(", ")}</td>
                <td>{u.ranking}</td>
                <td>{u.scholarship ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
