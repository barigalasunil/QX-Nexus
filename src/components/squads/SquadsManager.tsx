import React, { useMemo, useState } from 'react';
import { Field } from '@/components/common/Shared';
import { useReferenceData } from '@/hooks/useReferenceData';
import { useSquads } from '@/hooks/useSquads';
import { commonStyles, ThemeTokens } from '@/styles/theme';
import { User } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

type ConfirmDeleteState = {
  message: string;
  onConfirm: () => void;
} | null;

interface SquadsManagerProps {
  currentUser: User;
  showToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  theme: ThemeTokens;
  canEditSettings: boolean;
  setConfirmDelete: React.Dispatch<React.SetStateAction<ConfirmDeleteState>>;
}

export function SquadsManager({
  currentUser,
  showToast,
  theme,
  canEditSettings,
  setConfirmDelete,
}: SquadsManagerProps) {
  const [newSquadName, setNewSquadName] = useState('');
  const [newSquadProjectId, setNewSquadProjectId] = useState(currentUser.projectId || '');
  const { projects, loadingProjects } = useReferenceData();
  const { squads, createSquad, deleteSquad, loading } = useSquads();

  const isSuperAdmin = currentUser.role === 'superadmin';
  const projectOptions = useMemo(() => {
    return projects.map(project => ({ value: project.id, label: project.project_name }));
  }, [projects]);

  const projectMap = useMemo(() => {
    return new Map(projects.map(project => [project.id, project.project_name]));
  }, [projects]);

  const visibleSquads = useMemo(() => (
    isSuperAdmin
      ? squads
      : squads.filter(squad => squad.project_id === currentUser.projectId)
  ), [currentUser.projectId, isSuperAdmin, squads]);

  const handleAddSquad = async (event: React.FormEvent) => {
    event.preventDefault();
    const projectId = isSuperAdmin ? newSquadProjectId : currentUser.projectId;

    if (!projectId) {
      showToast('Select a project for this squad.', 'error');
      return;
    }

    try {
      const createdSquad = await createSquad(projectId, newSquadName, currentUser.id);
      setNewSquadName('');
      showToast(`Squad "${createdSquad.squad_name}" added.`, 'success');
    } catch (caughtError) {
      showToast(caughtError instanceof Error ? caughtError.message : 'Unable to create squad.', 'error');
    }
  };

  const handleRemoveSquad = (id: string) => {
    const squad = squads.find(item => item.id === id);
    if (!squad || (!isSuperAdmin && squad.project_id !== currentUser.projectId)) return;
    setConfirmDelete({
      message: 'Removing this Squad will invalidate existing metrics referencing it. Proceed?',
      onConfirm: async () => {
        try {
          await deleteSquad(id);
          showToast('Squad removed.', 'success');
          setConfirmDelete(null);
        } catch (caughtError) {
          showToast(caughtError instanceof Error ? caughtError.message : 'Unable to delete squad.', 'error');
        }
      },
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', flexWrap: 'wrap' }}>
      
      {canEditSettings && <div style={commonStyles.card(theme)}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '16px' }}>
          Add Squad Division
        </h3>
        <form onSubmit={handleAddSquad} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field
            label="Squad Name"
            type="text"
            placeholder="e.g. Payments Squad"
            value={newSquadName}
            onChange={setNewSquadName}
            required
            theme={theme}
          />
          {isSuperAdmin && <Field
            label="Project"
            type="select"
            value={newSquadProjectId}
            onChange={setNewSquadProjectId}
            options={projectOptions}
            placeholder="Select project"
            required
            theme={theme}
          />}
          <button type="submit" disabled={loadingProjects || loading} style={commonStyles.button(theme, 'primary')}>
            <Plus size={16} />
            Add Squad
          </button>
        </form>
      </div>}

      <div style={commonStyles.card(theme)}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '16px', borderLeft: `4px solid ${theme.indigo}`, paddingLeft: '8px' }}>
          Active Testing Squads
        </h3>
        {visibleSquads.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: '14px' }}>No squads recorded. Register a squad team.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visibleSquads.map((sq) => (
              <div
                key={sq.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 16px',
                  backgroundColor: theme.inputBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                }}
              >
                <span style={{ fontWeight: 600, color: theme.text }}>
                  {sq.squad_name}{isSuperAdmin ? ` · ${projectMap.get(sq.project_id) || 'Unassigned'}` : ''}
                </span>
                {canEditSettings && <button
                  onClick={() => handleRemoveSquad(sq.id)}
                  style={{
                    padding: '6px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: theme.red,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                </button>}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
