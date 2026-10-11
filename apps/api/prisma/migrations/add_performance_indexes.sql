-- Performance indexes for CoFounderBay
-- These indexes optimize common queries and improve overall performance

-- User and Profile indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON "User"(role);
CREATE INDEX IF NOT EXISTS idx_users_moderation_status ON "User"(moderationStatus);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON "User"(createdAt);
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON "User"(lastSeenAt);

-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON "Profile"(userId);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON "Profile"(displayName);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON "Profile"(location);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON "Profile"(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON "Profile"(createdAt);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON "Profile"(updatedAt);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_profiles_search ON "Profile" USING gin(to_tsvector('english', displayName || ' ' || COALESCE(bio, '') || ' ' || COALESCE(headline, '')));

-- Connection indexes
CREATE INDEX IF NOT EXISTS idx_connections_requester_id ON "ConnectionRequest"(requesterId);
CREATE INDEX IF NOT EXISTS idx_connections_receiver_id ON "ConnectionRequest"(receiverId);
CREATE INDEX IF NOT EXISTS idx_connections_status ON "ConnectionRequest"(status);
CREATE INDEX IF NOT EXISTS idx_connections_created_at ON "ConnectionRequest"(createdAt);
CREATE INDEX IF NOT EXISTS idx_connections_composite ON "ConnectionRequest"(requesterId, receiverId, status);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON "Message"(conversationId);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON "Message"(senderId);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON "Message"(createdAt);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON "Message"(conversationId, createdAt DESC);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON "ConversationParticipant"(userId);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON "ConversationParticipant"(conversationId);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_joined_at ON "ConversationParticipant"(joinedAt);

-- Event indexes
CREATE INDEX IF NOT EXISTS idx_events_host_id ON "Event"(hostId);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON "Event"(startAt);
CREATE INDEX IF NOT EXISTS idx_events_end_at ON "Event"(endAt);
CREATE INDEX IF NOT EXISTS idx_events_mode ON "Event"(mode);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON "Event"(eventType);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON "Event"(createdAt);

-- Event RSVP indexes
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON "EventRsvp"(userId);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON "EventRsvp"(eventId);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON "EventRsvp"(status);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_created_at ON "EventRsvp"(createdAt);

-- Group indexes
CREATE INDEX IF NOT EXISTS idx_groups_creator_id ON "Group"(creatorId);
CREATE INDEX IF NOT EXISTS idx_groups_privacy ON "Group"(privacy);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON "Group"(createdAt);

-- Group member indexes
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON "GroupMember"(userId);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON "GroupMember"(groupId);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON "GroupMember"(role);
CREATE INDEX IF NOT EXISTS idx_group_members_joined_at ON "GroupMember"(joinedAt);

-- Group post indexes
CREATE INDEX IF NOT EXISTS idx_group_posts_group_id ON "GroupPost"(groupId);
CREATE INDEX IF NOT EXISTS idx_group_posts_author_id ON "GroupPost"(authorId);
CREATE INDEX IF NOT EXISTS idx_group_posts_created_at ON "GroupPost"(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_group_posts_is_pinned ON "GroupPost"(isPinned);

-- Group comment indexes
CREATE INDEX IF NOT EXISTS idx_group_comments_post_id ON "GroupPostComment"(postId);
CREATE INDEX IF NOT EXISTS idx_group_comments_author_id ON "GroupPostComment"(authorId);
CREATE INDEX IF NOT EXISTS idx_group_comments_created_at ON "GroupPostComment"(createdAt DESC);

-- Group reaction indexes
CREATE INDEX IF NOT EXISTS idx_group_reactions_post_id ON "GroupPostReaction"(postId);
CREATE INDEX IF NOT EXISTS idx_group_reactions_user_id ON "GroupPostReaction"(userId);
CREATE INDEX IF NOT EXISTS idx_group_reactions_emoji ON "GroupPostReaction"(emoji);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON "Notification"(userId);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON "Notification"(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON "Notification"(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON "Notification"(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON "Notification"(userId, read, createdAt DESC);

-- Job indexes
CREATE INDEX IF NOT EXISTS idx_jobs_creator_id ON "JobPosting"(creatorId);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON "JobPosting"(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON "JobPosting"(isActive);

-- Mentor availability indexes
CREATE INDEX IF NOT EXISTS idx_mentor_availability_mentor_id ON "MentorAvailability"(mentorId);
CREATE INDEX IF NOT EXISTS idx_mentor_availability_start_time ON "MentorAvailability"(startTime);
CREATE INDEX IF NOT EXISTS idx_mentor_availability_end_time ON "MentorAvailability"(endTime);

-- Mentor booking indexes
CREATE INDEX IF NOT EXISTS idx_mentor_bookings_mentee_id ON "MentorBooking"(menteeId);
CREATE INDEX IF NOT EXISTS idx_mentor_bookings_mentor_id ON "MentorBooking"(mentorId);
CREATE INDEX IF NOT EXISTS idx_mentor_bookings_slot_id ON "MentorBooking"(slotId);
CREATE INDEX IF NOT EXISTS idx_mentor_bookings_status ON "MentorBooking"(status);
CREATE INDEX IF NOT EXISTS idx_mentor_bookings_start_time ON "MentorBooking"(startTime);

-- Upload indexes
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON "Upload"(userId);
CREATE INDEX IF NOT EXISTS idx_uploads_kind ON "Upload"(kind);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON "Upload"(createdAt DESC);

-- Report indexes
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON "Report"(reporterId);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id ON "Report"(reportedUserId);
CREATE INDEX IF NOT EXISTS idx_reports_type ON "Report"(type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON "Report"(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON "Report"(createdAt DESC);

-- Poll indexes
CREATE INDEX IF NOT EXISTS idx_polls_creator_id ON "Poll"(creatorId);
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON "Poll"(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_polls_is_active ON "Poll"(isActive);

-- Poll vote indexes
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON "PollVote"(pollId);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON "PollVote"(userId);

-- Invite indexes
CREATE INDEX IF NOT EXISTS idx_invites_sender_id ON "Invite"(senderId);
CREATE INDEX IF NOT EXISTS idx_invites_receiver_id ON "Invite"(receiverId);
CREATE INDEX IF NOT EXISTS idx_invites_status ON "Invite"(status);
CREATE INDEX IF NOT EXISTS idx_invites_created_at ON "Invite"(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON "Invite"(expiresAt);

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON "Subscription"(userId);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON "Subscription"(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON "Subscription"(createdAt);

-- Refresh token indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON "RefreshToken"(userId);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON "RefreshToken"(tokenHash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON "RefreshToken"(expiresAt);

-- Skill indexes
CREATE INDEX IF NOT EXISTS idx_skills_category ON "Skill"(category);
CREATE INDEX IF NOT EXISTS idx_skills_name ON "Skill"(name);

-- Profile skill indexes
CREATE INDEX IF NOT EXISTS idx_profile_skills_profile_id ON "ProfileSkill"(profileId);
CREATE INDEX IF NOT EXISTS idx_profile_skills_skill_id ON "ProfileSkill"(skillId);
