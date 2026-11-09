import { useFetch } from "../../hooks/useFetch";
import { Alert, EmptyState, PageHeader, Spinner } from "../../components/ui";
import ApplicationEditor from "./ApplicationEditor";

export default function EditPage({ fields }) {
  const { data, loading, error, reload } = useFetch("/candidates?mine=true");
  const profile = fields === "profile";
  return (
    <>
      <PageHeader title={profile ? "Profile management" : "Manifesto"} subtitle={profile ? "Update your party and photo while your application is pending." : "Update what you promise voters while your application is pending."} />
      <Alert type="error">{error}</Alert>
      {loading ? <Spinner /> : !data?.candidates.length ? <EmptyState title="No applications yet" text="Apply for an election from the Application Status page." /> : (
        <div className="grid max-w-3xl gap-5">{data.candidates.map((a) => <ApplicationEditor key={a._id} app={a} fields={fields} onSaved={reload} />)}</div>)}
    </>
  );
}
