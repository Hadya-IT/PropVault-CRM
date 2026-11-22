import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { MODULE_DEFS } from '../modules/defs';
import RecordsView from '../modules/RecordsView';
import PipelineView from '../modules/PipelineView';
import EntityOverview from '../modules/EntityOverview';
import { Empty, PageHeader, Spinner } from '../components/ui';

function useEntityMeta(code) {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    let alive = true;
    setMeta(null);
    api.get(`/entities/${code}/meta`).then((m) => alive && setMeta(m)).catch(() => alive && setMeta({ stages: [], users: [], fields: {} }));
    return () => { alive = false; };
  }, [code]);
  return meta;
}

export default function ModulePage() {
  const { entityCode, slug } = useParams();
  const entities = useAuth((s) => s.entities);
  const entity = entities.find((e) => e.code === entityCode);
  const mod = entity?.modules.find((m) => m.slug === slug);
  const meta = useEntityMeta(entityCode);

  if (!entity || !mod) return <Empty title="Not available">This module is not assigned to you.</Empty>;
  if (!meta) return <div className="grid place-items-center py-16"><Spinner /></div>;

  if (mod.module === 'overview') return <EntityOverview key={entityCode} entity={entity} mod={mod} />;
  if (mod.module === 'pipeline') return <PipelineView entity={entity} mod={mod} meta={meta} />;
  if (MODULE_DEFS[mod.module]) return <RecordsView key={`${entityCode}/${slug}`} entity={entity} mod={mod} def={MODULE_DEFS[mod.module]} meta={meta} />;

  // reports: week 4; segments/jobs/catalog: phase 2
  return (
    <div>
      <PageHeader title={mod.label} subtitle={entity.name} />
      <Empty title="Coming in a later build">The {mod.label} screen is scheduled after the core modules.</Empty>
    </div>
  );
}