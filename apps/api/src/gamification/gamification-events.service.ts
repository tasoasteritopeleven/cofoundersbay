import { Injectable, Logger } from '@nestjs/common';
import { XPEventType } from '@prisma/client';
import { GamificationService } from './gamification.service';

/**
 * Event Ingestion Layer for Gamification
 * 
 * This service provides high-level methods to record meaningful platform events
 * that trigger XP, badges, streaks, and score updates. Called by controllers
 * after successful user actions.
 * 
 * Anti-pattern: Do NOT call recordXPEvent directly from controllers.
 * Pattern: Call these semantic methods which apply correct multipliers and metadata.
 */
@Injectable()
export class GamificationEventsService {
  private readonly logger = new Logger(GamificationEventsService.name);

  constructor(private readonly gamification: GamificationService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // RESEARCH CANVAS EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  async onBoardCreated(userId: string, boardId: string, metadata?: Record<string, any>) {
    return this.gamification.recordXPEvent(userId, XPEventType.CREATE_BOARD, {
      entityType: 'research_board',
      entityId: boardId,
      metadata,
    });
  }

  async onNodeCreated(
    userId: string,
    nodeId: string,
    boardId: string,
    nodeType: string,
    qualityScore = 1.0,
  ) {
    // Research nodes contribute to team collaboration
    return this.gamification.recordXPEvent(userId, XPEventType.TEAM_CONTRIBUTION, {
      workspaceId: boardId,
      entityType: 'research_node',
      entityId: nodeId,
      qualityMultiplier: qualityScore,
      metadata: { nodeType, action: 'create_node' },
    });
  }

  async onNodeImproved(
    userId: string,
    nodeId: string,
    boardId: string,
    improvementDelta: number,
  ) {
    const qualityMult = Math.min(1.0 + improvementDelta / 100, 2.0);
    // Node improvements count as team contributions
    return this.gamification.recordXPEvent(userId, XPEventType.TEAM_CONTRIBUTION, {
      workspaceId: boardId,
      entityType: 'research_node',
      entityId: nodeId,
      qualityMultiplier: qualityMult,
      metadata: { improvementDelta, action: 'improve_node' },
    });
  }

  async onBoardSynthesized(
    userId: string,
    boardId: string,
    synthesisQuality: number,
    nodeCount: number,
  ) {
    const qualityMult = Math.min(1.0 + synthesisQuality / 100, 2.0);
    return this.gamification.recordXPEvent(userId, XPEventType.SYNTHESIZE_BOARD, {
      workspaceId: boardId,
      entityType: 'research_board',
      entityId: boardId,
      qualityMultiplier: qualityMult,
      metadata: { nodeCount, synthesisQuality },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BUILDER ARTIFACT EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  async onArtifactCreated(
    userId: string,
    documentId: string,
    workspaceId: string,
    artifactType: string,
  ) {
    return this.gamification.recordXPEvent(userId, XPEventType.CREATE_ARTIFACT, {
      workspaceId,
      entityType: 'builder_document',
      entityId: documentId,
      metadata: { artifactType },
    });
  }

  async onArtifactImproved(
    userId: string,
    documentId: string,
    workspaceId: string,
    completionDelta: number,
    collaboratorCount = 1,
  ) {
    const qualityMult = Math.min(1.0 + completionDelta / 100, 2.0);
    const collabMult = Math.min(1.0 + (collaboratorCount - 1) * 0.2, 1.5);
    
    return this.gamification.recordXPEvent(userId, XPEventType.IMPROVE_ARTIFACT, {
      workspaceId,
      entityType: 'builder_document',
      entityId: documentId,
      qualityMultiplier: qualityMult,
      collaborationMultiplier: collabMult,
      metadata: { completionDelta, collaboratorCount },
    });
  }

  async onArtifactCompleted(
    userId: string,
    documentId: string,
    workspaceId: string,
    finalCompletionPct: number,
  ) {
    const qualityMult = Math.min(finalCompletionPct / 100, 1.5);
    return this.gamification.recordXPEvent(userId, XPEventType.COMPLETE_ARTIFACT, {
      workspaceId,
      entityType: 'builder_document',
      entityId: documentId,
      qualityMultiplier: qualityMult,
      metadata: { finalCompletionPct },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COLLABORATION EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  async onConnectionMade(userId: string, connectionId: string, otherUserId: string) {
    // Connections are validated progress (mutual acceptance required)
    return this.gamification.recordXPEvent(userId, XPEventType.VALIDATED_PROGRESS, {
      entityType: 'connection',
      entityId: connectionId,
      metadata: { otherUserId, action: 'connection_made' },
    });
  }

  async onCollaborationStarted(
    userId: string,
    workspaceId: string,
    collaboratorId: string,
  ) {
    // Starting collaboration = inviting a collaborator who accepts
    return this.gamification.recordXPEvent(userId, XPEventType.INVITE_COLLABORATOR, {
      workspaceId,
      entityType: 'workspace',
      entityId: workspaceId,
      metadata: { collaboratorId },
    });
  }

  async onReviewGiven(
    userId: string,
    reviewId: string,
    documentId: string,
    workspaceId: string,
    reviewDepth: number,
  ) {
    const qualityMult = Math.min(1.0 + reviewDepth / 10, 2.0);
    // Giving reviews = providing feedback
    return this.gamification.recordXPEvent(userId, XPEventType.PROVIDE_FEEDBACK, {
      workspaceId,
      entityType: 'review',
      entityId: reviewId,
      qualityMultiplier: qualityMult,
      metadata: { documentId, reviewDepth },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MENTOR FEEDBACK LOOP EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  async onMentorFeedbackReceived(
    userId: string,
    reviewId: string,
    workspaceId: string,
    mentorId: string,
  ) {
    return this.gamification.recordXPEvent(userId, XPEventType.RECEIVE_MENTOR_FEEDBACK, {
      workspaceId,
      entityType: 'expert_review',
      entityId: reviewId,
      metadata: { mentorId },
    });
  }

  async onFeedbackApplied(
    userId: string,
    reviewId: string,
    workspaceId: string,
    improvementScore: number,
  ) {
    const qualityMult = Math.min(1.0 + improvementScore / 50, 2.0);
    return this.gamification.recordXPEvent(userId, XPEventType.APPLY_FEEDBACK, {
      workspaceId,
      entityType: 'expert_review',
      entityId: reviewId,
      qualityMultiplier: qualityMult,
      metadata: { improvementScore },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MILESTONE EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  async onMilestoneCompleted(
    userId: string,
    milestoneId: string,
    workspaceId: string,
    onTimeBonus: boolean,
  ) {
    const weightMult = onTimeBonus ? 1.2 : 1.0;
    return this.gamification.recordXPEvent(userId, XPEventType.COMPLETE_MILESTONE, {
      workspaceId,
      entityType: 'milestone',
      entityId: milestoneId,
      weightMultiplier: weightMult,
      metadata: { onTimeBonus },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CROSS-TOOL TRANSFER EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  async onCanvasToBuilderTransfer(
    userId: string,
    boardId: string,
    documentId: string,
    workspaceId: string,
  ) {
    // Canvas to builder transfer = linking artifacts
    return this.gamification.recordXPEvent(userId, XPEventType.LINK_ARTIFACTS, {
      workspaceId,
      entityType: 'transfer',
      entityId: `${boardId}->${documentId}`,
      metadata: { boardId, documentId, action: 'canvas_to_builder' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VALIDATION EVENTS
  // ══════════════════════════════════════════════════════════════════════════

  async onProgressValidated(
    userId: string,
    validationId: string,
    workspaceId: string,
    validatorId: string,
  ) {
    return this.gamification.recordXPEvent(userId, XPEventType.VALIDATED_PROGRESS, {
      workspaceId,
      entityType: 'validation',
      entityId: validationId,
      metadata: { validatorId },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH OPERATIONS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Record multiple events atomically (e.g., when completing a complex workflow)
   */
  async recordBatch(
    events: Array<{
      userId: string;
      eventType: XPEventType;
      workspaceId?: string;
      entityType?: string;
      entityId?: string;
      qualityMultiplier?: number;
      collaborationMultiplier?: number;
      weightMultiplier?: number;
      metadata?: Record<string, any>;
    }>,
  ) {
    const results = await Promise.allSettled(
      events.map((event) =>
        this.gamification.recordXPEvent(event.userId, event.eventType, {
          workspaceId: event.workspaceId,
          entityType: event.entityType,
          entityId: event.entityId,
          qualityMultiplier: event.qualityMultiplier,
          collaborationMultiplier: event.collaborationMultiplier,
          weightMultiplier: event.weightMultiplier,
          metadata: event.metadata,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (failed > 0) {
      this.logger.warn(`Batch XP recording: ${succeeded} succeeded, ${failed} failed`);
    }

    return { succeeded, failed, results };
  }
}
