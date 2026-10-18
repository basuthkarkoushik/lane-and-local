import PageHeader from '../components/PageHeader';
import { Loading, ErrorBox } from '../components/Feedback';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';

export default function Placeholder({ title }) {
  const { loading, error, reload } = useAsync(() => api.health(), []);
  return (
    <>
      <PageHeader title={title} subtitle="This page is built in an upcoming step." />
      <div className="card">
        {loading && <Loading text="Checking server..." />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!loading && !error && <div className="success-box">Website is connected to the server.</div>}
      </div>
    </>
  );
}