import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api, { errMsg } from "../../services/api";
import { Alert, Field, PageHeader, Spinner } from "../../components/ui";
import { toLocalInput } from "../../utils/format";

export default function ElectionForm() {
  const { id } = useParams(); const edit = !!id; const nav = useNavigate();
  const [f, setF] = useState({ electionName: "", description: "", startDate: "", endDate: "" });
  const [loading, setLoading] = useState(edit); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    if (!edit) return;
    api.get(`/elections/${id}`).then(({ data }) => { const e = data.election; setF({ electionName: e.electionName, description: e.description, startDate: toLocalInput(e.startDate), endDate: toLocalInput(e.endDate) }); })
      .catch((e) => setErr(errMsg(e))).finally(() => setLoading(false));
  }, [id, edit]);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setFieldErr({});
    if (new Date(f.endDate) <= new Date(f.startDate)) { setFieldErr({ endDate: "End must be after start" }); return; }
    setBusy(true);
    try {
      const body = { ...f, startDate: new Date(f.startDate).toISOString(), endDate: new Date(f.endDate).toISOString() };
      if (edit) await api.patch(`/elections/${id}`, body); else await api.post("/elections", body);
      nav("/admin/elections");
    } catch (e2) {
      const d = e2?.response?.data?.details; if (Array.isArray(d)) setFieldErr(Object.fromEntries(d.map((x) => [x.field, x.message])));
      setErr(errMsg(e2));
    } finally { setBusy(false); }
  };
  if (loading) return <Spinner />;
  return (
    <>
      <PageHeader title={edit ? "Edit election" : "Create election"} subtitle="The election is created on the smart contract in the same step, so this may take a few seconds." />
      <form onSubmit={submit} className="card max-w-2xl space-y-4">
        <Alert type="error">{err}</Alert>
        <Field label="Election name" error={fieldErr.electionName}><input className="input" value={f.electionName} onChange={set("electionName")} required minLength={3} /></Field>
        <Field label="Description" error={fieldErr.description}><textarea className="input min-h-[100px]" value={f.description} onChange={set("description")} maxLength={2000} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start" error={fieldErr.startDate}><input className="input" type="datetime-local" value={f.startDate} onChange={set("startDate")} required /></Field>
          <Field label="End" error={fieldErr.endDate}><input className="input" type="datetime-local" value={f.endDate} onChange={set("endDate")} required /></Field>
        </div>
        <p className="text-xs text-slate-400">Candidates must be approved before the start time. Start and end are fixed on-chain once voting begins.</p>
        <div className="flex gap-2"><button className="btn-primary" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {edit ? "Save changes" : "Create election"}</button>
          <button type="button" className="btn-outline" onClick={() => nav("/admin/elections")}>Cancel</button></div>
      </form>
    </>
  );
}
