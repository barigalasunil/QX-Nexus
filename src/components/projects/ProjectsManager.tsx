import React, { useEffect, useState } from 'react';
import { ThemeTokens, commonStyles } from '@/styles/theme';
import { Field } from '@/components/common/Shared';
import { useReferenceData } from '@/hooks/useReferenceData';
import { ProjectService } from '@/services/project.service';
import { Plus, Trash2 } from 'lucide-react';

type ConfirmDeleteState = {
  message: string;
  onConfirm: () => void;
} | null;

interface ProjectsManagerProps {
  createdBy: string;
  showToast: (msg: string, type: 'success' | 'error' | 'warning') => void;
  theme: ThemeTokens;
  canEditSettings: boolean;
  setConfirmDelete: React.Dispatch<React.SetStateAction<ConfirmDeleteState>>;
}

export function ProjectsManager({
  createdBy,
  showToast,
  theme,
  canEditSettings,
  setConfirmDelete,
}: ProjectsManagerProps) {
  const [newProjectName, setNewProjectName] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const { projects, loading, refreshProjects } = useReferenceData();

  useEffect(() => {
    if (mutationError) {
      showToast(mutationError, 'error');
    }
  }, [mutationError, showToast]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutating(true);
    setMutationError(null);

    try {
      const createdProject = await ProjectService.createProject(newProjectName, createdBy);
      await refreshProjects();
      setNewProjectName('');
      showToast(`Project "${createdProject.project_name}" added.`, 'success');
    } catch (caughtError) {
      setMutationError(caughtError instanceof Error ? caughtError.message : 'Unable to create project.');
    } finally {
      setMutating(false);
    }
  };

  const handleRemoveProject = (id: string) => {
    setConfirmDelete({
      message: 'Removing this project will invalidate existing metrics referencing it. Proceed?',
      onConfirm: async () => {
        setMutating(true);
        setMutationError(null);
        try {
          await ProjectService.deleteProject(id);
          await refreshProjects();
          showToast('Project removed.', 'success');
          setConfirmDelete(null);
        } catch (caughtError) {
          setMutationError(caughtError instanceof Error ? caughtError.message : 'Unable to delete project.');
        } finally {
          setMutating(false);
        }
      },
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', flexWrap: 'wrap' }}>
      
      {canEditSettings && <div style={commonStyles.card(theme)}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '16px' }}>
          Add Project Scope
        </h3>
        <form onSubmit={handleAddProject} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field
            label="Project Name"
            type="text"
            placeholder="e.g. Customer Portal Web"
            value={newProjectName}
            onChange={setNewProjectName}
            required
            theme={theme}
          />
          <button type="submit" disabled={loading || mutating} style={commonStyles.button(theme, 'primary')}>
            <Plus size={16} />
            Add Project
          </button>
        </form>
      </div>}

      {canEditSettings && <div style={commonStyles.card(theme)}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, marginBottom: '16px', borderLeft: `4px solid ${theme.blue}`, paddingLeft: '8px' }}>
          Active Project Portfolios
        </h3>
        {projects.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: '14px' }}>No active projects recorded. Register a project scope.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.map((proj) => (
              <div
                key={proj.id}
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
                <span style={{ fontWeight: 600, color: theme.text }}>{proj.project_name}</span>
                <button
                  onClick={() => handleRemoveProject(proj.id)}
                  style={{
                    padding: '6px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: theme.red,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>}

    </div>
  );
}
