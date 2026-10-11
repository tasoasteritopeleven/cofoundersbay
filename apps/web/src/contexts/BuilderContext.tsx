'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  builderApi,
  BuilderWorkspace,
  BuilderDocument,
  BuilderCollaborator,
  BuilderComment,
  ReadinessAssessment,
  BuilderApplication,
  BuilderDocumentType,
  AIGenerationResult,
} from '@/lib/builder-api';
import { useBuilderSocket, CollaboratorPresence } from '@/hooks/useBuilderSocket';

interface BuilderState {
  // Current workspace
  workspace: BuilderWorkspace | null;
  workspaces: BuilderWorkspace[];
  isLoadingWorkspaces: boolean;

  // Documents
  documents: BuilderDocument[];
  activeDocument: BuilderDocument | null;
  isLoadingDocuments: boolean;

  // Collaborators
  collaborators: BuilderCollaborator[];
  onlineCollaborators: CollaboratorPresence[];

  // Comments
  comments: BuilderComment[];

  // Readiness
  readinessAssessment: ReadinessAssessment | null;

  // Applications
  applications: BuilderApplication[];

  // AI Generation
  isGenerating: boolean;
  lastGeneration: AIGenerationResult | null;

  // Errors
  error: string | null;
}

interface BuilderContextValue extends BuilderState {
  // Workspace actions
  loadWorkspaces: (autoSelectFirst?: boolean) => Promise<void>;
  createWorkspace: (data: { name: string; description?: string; startupName?: string; industry?: string; stage?: string }) => Promise<BuilderWorkspace>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  updateWorkspace: (data: Partial<BuilderWorkspace>) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;

  // Document actions
  loadDocuments: () => Promise<void>;
  createDocument: (type: BuilderDocumentType, title: string) => Promise<BuilderDocument>;
  selectDocument: (documentId: string) => Promise<void>;
  updateDocument: (documentId: string, data: Partial<BuilderDocument>) => Promise<void>;
  updateDocumentSection: (documentId: string, sectionKey: string, content: Record<string, any>) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;

  // Collaborator actions
  loadCollaborators: () => Promise<void>;
  addCollaborator: (userId: string, role: string) => Promise<void>;
  removeCollaborator: (collaboratorId: string) => Promise<void>;

  // Comment actions
  loadComments: (documentId: string) => Promise<void>;
  addComment: (documentId: string, body: string, sectionKey?: string) => Promise<void>;
  resolveComment: (commentId: string) => Promise<void>;

  // Readiness actions
  assessReadiness: () => Promise<void>;
  updateReadinessCriterion: (dimension: string, criterionId: string, completed: boolean) => Promise<void>;

  // Application actions
  loadApplications: () => Promise<void>;
  createApplication: (templateType: string, templateName: string) => Promise<BuilderApplication>;
  updateApplication: (applicationId: string, answers: Record<string, string>) => Promise<void>;

  // AI actions
  generateContent: (documentType: BuilderDocumentType, sectionKey?: string, context?: Record<string, any>) => Promise<AIGenerationResult>;
  generateApplicationAnswer: (question: string, context?: Record<string, any>) => Promise<string>;
  improveContent: (content: string, documentType: BuilderDocumentType, feedback?: string) => Promise<string>;

  // Real-time actions
  startTyping: (sectionKey?: string) => void;
  stopTyping: (sectionKey?: string) => void;
  broadcastSectionUpdate: (sectionKey: string, content: Record<string, any>) => void;

  // Utility
  clearError: () => void;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function useBuilder() {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error('useBuilder must be used within a BuilderProvider');
  }
  return context;
}

interface BuilderProviderProps {
  children: ReactNode;
}

export function BuilderProvider({ children }: BuilderProviderProps) {
  const [state, setState] = useState<BuilderState>({
    workspace: null,
    workspaces: [],
    isLoadingWorkspaces: false,
    documents: [],
    activeDocument: null,
    isLoadingDocuments: false,
    collaborators: [],
    onlineCollaborators: [],
    comments: [],
    readinessAssessment: null,
    applications: [],
    isGenerating: false,
    lastGeneration: null,
    error: null,
  });

  // WebSocket hook for real-time collaboration
  const socket = useBuilderSocket({
    onCollaboratorJoined: (data) => {
      setState((prev) => ({
        ...prev,
        onlineCollaborators: [...prev.onlineCollaborators, data],
      }));
    },
    onCollaboratorLeft: (data) => {
      setState((prev) => ({
        ...prev,
        onlineCollaborators: prev.onlineCollaborators.filter((c) => c.odId !== data.odId),
      }));
    },
    onSectionUpdated: (data) => {
      // Update document section from remote collaborator
      if (state.activeDocument) {
        setState((prev) => {
          if (!prev.activeDocument) return prev;
          const updatedContent = { ...prev.activeDocument.content, [data.sectionKey]: data.content };
          return {
            ...prev,
            activeDocument: { ...prev.activeDocument, content: updatedContent },
          };
        });
      }
    },
    onCommentAdded: (data) => {
      setState((prev) => ({
        ...prev,
        comments: [
          ...prev.comments,
          {
            id: data.commentId,
            documentId: state.activeDocument?.id || '',
            body: data.body,
            sectionKey: data.sectionKey,
            status: 'open' as const,
            createdAt: data.createdAt,
            updatedAt: data.createdAt,
            author: {
              id: data.authorId,
              displayName: data.authorName,
            },
          },
        ],
      }));
    },
    onCommentResolved: (data) => {
      setState((prev) => ({
        ...prev,
        comments: prev.comments.map((c) =>
          c.id === data.commentId ? { ...c, status: 'resolved' as const } : c
        ),
      }));
    },
  });

  // Join workspace room when workspace changes
  useEffect(() => {
    if (state.workspace && socket.isConnected) {
      socket.joinWorkspace(state.workspace.id);
      return () => {
        socket.leaveWorkspace(state.workspace!.id);
      };
    }
  }, [state.workspace?.id, socket.isConnected]);

  // Join document room when active document changes
  useEffect(() => {
    if (state.activeDocument && state.workspace && socket.isConnected) {
      socket.joinDocument(state.activeDocument.id, state.workspace.id);
      return () => {
        socket.leaveDocument(state.activeDocument!.id);
      };
    }
  }, [state.activeDocument?.id, state.workspace?.id, socket.isConnected]);

  // Update online collaborators from socket
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      onlineCollaborators: socket.collaborators,
    }));
  }, [socket.collaborators]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Workspace Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const loadWorkspaces = useCallback(async (autoSelectFirst = false) => {
    setState((prev) => ({ ...prev, isLoadingWorkspaces: true, error: null }));
    try {
      const response = await builderApi.getWorkspaces();
      const list = response.data;

      // Auto-select first workspace in the SAME call → eliminates waterfall
      if (autoSelectFirst && list.length > 0) {
        const fullWorkspace = await builderApi.getWorkspace(list[0].id);
        setState((prev) => ({
          ...prev,
          workspaces: list,
          workspace: fullWorkspace,
          documents: fullWorkspace.documents || [],
          collaborators: fullWorkspace.collaborators || [],
          isLoadingWorkspaces: false,
          isLoadingDocuments: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          workspaces: list,
          isLoadingWorkspaces: false,
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load workspaces',
        isLoadingWorkspaces: false,
      }));
    }
  }, []);

  const createWorkspace = useCallback(async (data: { name: string; description?: string; startupName?: string; industry?: string; stage?: string }) => {
    setState((prev) => ({ ...prev, error: null }));
    try {
      const workspace = await builderApi.createWorkspace(data);
      setState((prev) => ({
        ...prev,
        workspaces: [workspace, ...prev.workspaces],
        workspace,
      }));
      return workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      setState((prev) => ({ ...prev, error: message }));
      throw err;
    }
  }, []);

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    setState((prev) => ({ ...prev, isLoadingDocuments: true, error: null }));
    try {
      const workspace = await builderApi.getWorkspace(workspaceId);
      setState((prev) => ({
        ...prev,
        workspace,
        documents: workspace.documents || [],
        collaborators: workspace.collaborators || [],
        isLoadingDocuments: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load workspace',
        isLoadingDocuments: false,
      }));
    }
  }, []);

  const updateWorkspace = useCallback(async (data: Partial<BuilderWorkspace>) => {
    if (!state.workspace) return;
    try {
      const updated = await builderApi.updateWorkspace(state.workspace.id, data);
      setState((prev) => ({
        ...prev,
        workspace: updated,
        workspaces: prev.workspaces.map((w) => (w.id === updated.id ? updated : w)),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to update workspace',
      }));
    }
  }, [state.workspace]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    try {
      await builderApi.deleteWorkspace(workspaceId);
      setState((prev) => ({
        ...prev,
        workspaces: prev.workspaces.filter((w) => w.id !== workspaceId),
        workspace: prev.workspace?.id === workspaceId ? null : prev.workspace,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to delete workspace',
      }));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Document Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const loadDocuments = useCallback(async () => {
    if (!state.workspace) return;
    setState((prev) => ({ ...prev, isLoadingDocuments: true }));
    try {
      const workspace = await builderApi.getWorkspace(state.workspace.id);
      setState((prev) => ({
        ...prev,
        documents: workspace.documents || [],
        isLoadingDocuments: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load documents',
        isLoadingDocuments: false,
      }));
    }
  }, [state.workspace]);

  const createDocument = useCallback(async (type: BuilderDocumentType, title: string) => {
    if (!state.workspace) throw new Error('No workspace selected');
    try {
      const document = await builderApi.createDocument({
        workspaceId: state.workspace.id,
        type,
        title,
      });
      setState((prev) => ({
        ...prev,
        documents: [document, ...prev.documents],
        activeDocument: document,
      }));
      return document;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to create document',
      }));
      throw err;
    }
  }, [state.workspace]);

  const selectDocument = useCallback(async (documentId: string) => {
    try {
      const document = await builderApi.getDocument(documentId);
      setState((prev) => ({
        ...prev,
        activeDocument: document,
        documents: prev.documents.map((d) => (d.id === documentId ? { ...d, ...document } : d)),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load document',
      }));
    }
  }, []);

  const updateDocument = useCallback(async (documentId: string, data: Partial<BuilderDocument>) => {
    try {
      const updated = await builderApi.updateDocument(documentId, data);
      setState((prev) => ({
        ...prev,
        documents: prev.documents.map((d) => (d.id === documentId ? updated : d)),
        activeDocument: prev.activeDocument?.id === documentId ? updated : prev.activeDocument,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to update document',
      }));
    }
  }, []);

  const updateDocumentSection = useCallback(async (documentId: string, sectionKey: string, content: Record<string, any>) => {
    try {
      await builderApi.updateDocumentSection(documentId, sectionKey, { content });
      setState((prev) => {
        const mergeContent = (existing?: Record<string, any>) => ({
          ...(existing ?? {}),
          [sectionKey]: content,
        });
        return {
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === documentId
              ? {
                  ...d,
                  content: mergeContent(d.content),
                  version: (typeof d.version === 'number' ? d.version : 0) + 1,
                  updatedAt: new Date().toISOString(),
                }
              : d,
          ),
          activeDocument:
            prev.activeDocument?.id === documentId
              ? {
                  ...prev.activeDocument,
                  content: mergeContent(prev.activeDocument.content),
                  version: (typeof prev.activeDocument.version === 'number' ? prev.activeDocument.version : 0) + 1,
                  updatedAt: new Date().toISOString(),
                }
              : prev.activeDocument,
        };
      });
      // Broadcast to collaborators
      socket.updateSection(documentId, sectionKey, content);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to update section',
      }));
      throw err;
    }
  }, [socket]);

  const deleteDocument = useCallback(async (documentId: string) => {
    try {
      await builderApi.deleteDocument(documentId);
      setState((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== documentId),
        activeDocument: prev.activeDocument?.id === documentId ? null : prev.activeDocument,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to delete document',
      }));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Collaborator Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const loadCollaborators = useCallback(async () => {
    if (!state.workspace) return;
    try {
      const collaborators = await builderApi.getCollaborators(state.workspace.id);
      setState((prev) => ({ ...prev, collaborators }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load collaborators',
      }));
    }
  }, [state.workspace]);

  const addCollaborator = useCallback(async (userId: string, role: string) => {
    if (!state.workspace) return;
    try {
      const collaborator = await builderApi.addCollaborator(state.workspace.id, {
        userId,
        role: role as any,
      });
      setState((prev) => ({
        ...prev,
        collaborators: [...prev.collaborators, collaborator],
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to add collaborator',
      }));
    }
  }, [state.workspace]);

  const removeCollaborator = useCallback(async (collaboratorId: string) => {
    if (!state.workspace) return;
    try {
      await builderApi.removeCollaborator(state.workspace.id, collaboratorId);
      setState((prev) => ({
        ...prev,
        collaborators: prev.collaborators.filter((c) => c.id !== collaboratorId),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to remove collaborator',
      }));
    }
  }, [state.workspace]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Comment Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const loadComments = useCallback(async (documentId: string) => {
    try {
      const comments = await builderApi.getDocumentComments(documentId);
      setState((prev) => ({ ...prev, comments }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load comments',
      }));
    }
  }, []);

  const addComment = useCallback(async (documentId: string, body: string, sectionKey?: string) => {
    try {
      const comment = await builderApi.createComment({ documentId, body, sectionKey });
      setState((prev) => ({ ...prev, comments: [...prev.comments, comment] }));
      // Broadcast to collaborators
      socket.addComment({ documentId, commentId: comment.id, body, sectionKey });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to add comment',
      }));
    }
  }, [socket]);

  const resolveComment = useCallback(async (commentId: string) => {
    try {
      await builderApi.resolveComment(commentId);
      setState((prev) => ({
        ...prev,
        comments: prev.comments.map((c) =>
          c.id === commentId ? { ...c, status: 'resolved' as const } : c
        ),
      }));
      // Broadcast to collaborators
      if (state.activeDocument) {
        socket.resolveComment(state.activeDocument.id, commentId);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to resolve comment',
      }));
    }
  }, [socket, state.activeDocument]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Readiness Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const assessReadiness = useCallback(async () => {
    if (!state.workspace) return;
    try {
      const assessment = await builderApi.assessReadiness({ workspaceId: state.workspace.id });
      setState((prev) => ({ ...prev, readinessAssessment: assessment }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to assess readiness',
      }));
    }
  }, [state.workspace]);

  const updateReadinessCriterion = useCallback(async (dimension: string, criterionId: string, completed: boolean) => {
    if (!state.workspace) return;
    try {
      await builderApi.updateReadinessCriterion(state.workspace.id, {
        dimension: dimension as any,
        criterionId,
        completed,
      });
      // Refresh assessment
      await assessReadiness();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to update criterion',
      }));
    }
  }, [state.workspace, assessReadiness]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Application Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const loadApplications = useCallback(async () => {
    if (!state.workspace) return;
    try {
      const applications = await builderApi.getApplications(state.workspace.id);
      setState((prev) => ({ ...prev, applications }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load applications',
      }));
    }
  }, [state.workspace]);

  const createApplication = useCallback(async (templateType: string, templateName: string) => {
    if (!state.workspace) throw new Error('No workspace selected');
    try {
      const application = await builderApi.createApplication({
        workspaceId: state.workspace.id,
        templateType: templateType as any,
        templateName,
      });
      setState((prev) => ({
        ...prev,
        applications: [...prev.applications, application],
      }));
      return application;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to create application',
      }));
      throw err;
    }
  }, [state.workspace]);

  const updateApplication = useCallback(async (applicationId: string, answers: Record<string, string>) => {
    try {
      const updated = await builderApi.updateApplication(applicationId, { answers });
      setState((prev) => ({
        ...prev,
        applications: prev.applications.map((a) => (a.id === applicationId ? updated : a)),
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to update application',
      }));
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // AI Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const generateContent = useCallback(async (documentType: BuilderDocumentType, sectionKey?: string, context?: Record<string, any>) => {
    if (!state.workspace) throw new Error('No workspace selected');
    setState((prev) => ({ ...prev, isGenerating: true, error: null }));
    try {
      const result = await builderApi.generateContent({
        workspaceId: state.workspace.id,
        documentType,
        sectionKey,
        context,
      });
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        lastGeneration: result,
      }));
      return result;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        error: err instanceof Error ? err.message : 'Failed to generate content',
      }));
      throw err;
    }
  }, [state.workspace]);

  const generateApplicationAnswer = useCallback(async (question: string, context?: Record<string, any>) => {
    if (!state.workspace) throw new Error('No workspace selected');
    setState((prev) => ({ ...prev, isGenerating: true }));
    try {
      const result = await builderApi.generateApplicationAnswer({
        workspaceId: state.workspace.id,
        question,
        context,
      });
      setState((prev) => ({ ...prev, isGenerating: false }));
      return result.answer;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        error: err instanceof Error ? err.message : 'Failed to generate answer',
      }));
      throw err;
    }
  }, [state.workspace]);

  const improveContent = useCallback(async (content: string, documentType: BuilderDocumentType, feedback?: string) => {
    setState((prev) => ({ ...prev, isGenerating: true }));
    try {
      const result = await builderApi.improveContent({ content, documentType, feedback });
      setState((prev) => ({ ...prev, isGenerating: false }));
      return result.improved;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        error: err instanceof Error ? err.message : 'Failed to improve content',
      }));
      throw err;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Real-time Actions
  // ─────────────────────────────────────────────────────────────────────────────

  const startTyping = useCallback((sectionKey?: string) => {
    if (state.activeDocument) {
      socket.startTyping(state.activeDocument.id, sectionKey);
    }
  }, [socket, state.activeDocument]);

  const stopTyping = useCallback((sectionKey?: string) => {
    if (state.activeDocument) {
      socket.stopTyping(state.activeDocument.id, sectionKey);
    }
  }, [socket, state.activeDocument]);

  const broadcastSectionUpdate = useCallback((sectionKey: string, content: Record<string, any>) => {
    if (state.activeDocument) {
      socket.updateSection(state.activeDocument.id, sectionKey, content);
    }
  }, [socket, state.activeDocument]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────────

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value: BuilderContextValue = {
    ...state,
    loadWorkspaces,
    createWorkspace,
    selectWorkspace,
    updateWorkspace,
    deleteWorkspace,
    loadDocuments,
    createDocument,
    selectDocument,
    updateDocument,
    updateDocumentSection,
    deleteDocument,
    loadCollaborators,
    addCollaborator,
    removeCollaborator,
    loadComments,
    addComment,
    resolveComment,
    assessReadiness,
    updateReadinessCriterion,
    loadApplications,
    createApplication,
    updateApplication,
    generateContent,
    generateApplicationAnswer,
    improveContent,
    startTyping,
    stopTyping,
    broadcastSectionUpdate,
    clearError,
  };

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}
