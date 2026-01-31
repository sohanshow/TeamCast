'use client';

import { useState, useRef, useEffect } from 'react';

interface Comment {
  id: string;
  username: string;
  text: string;
  timestamp: number;
}

interface CommentsProps {
  roomId: string;
  username: string;
  userId: string;
  onBatchReady?: (comments: Comment[]) => void;
}

export default function Comments({ roomId, username, userId, onBatchReady }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId,
          username,
          text: newComment.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setComments((prev) => [...prev, data.comment]);
        setNewComment('');
        setPendingCount(data.stats.pendingComments);

        if (data.shouldProcessBatch && data.batch && onBatchReady) {
          onBatchReady(data.batch.comments);
        }
      }
    } catch (error) {
      console.error('Failed to submit comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-surface-overlay border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-raised">
        <h3 className="font-display text-xl font-semibold">Live Chat</h3>
        <div className="flex gap-2">
          <span className="px-3 py-1 text-xs font-medium bg-surface-elevated rounded-full text-steel-400">
            {comments.length} messages
          </span>
          {pendingCount > 0 && (
            <span className="px-3 py-1 text-xs font-semibold bg-accent-emerald/20 text-accent-emerald rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <span className="text-4xl mb-4 opacity-50">💬</span>
            <p className="text-steel-400 font-medium">Be the first to comment!</p>
            <p className="text-sm text-steel-600 mt-1">
              Your comments may be featured in the podcast
            </p>
          </div>
        ) : (
          comments.map((comment, index) => (
            <div
              key={comment.id}
              className="p-3 bg-surface-raised rounded-lg animate-slide-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-accent text-sm">@{comment.username}</span>
                <span className="text-xs text-steel-600">{formatTime(comment.timestamp)}</span>
              </div>
              <p className="text-sm text-steel-200 leading-relaxed">{comment.text}</p>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 p-4 border-t border-border bg-surface-raised">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          className="flex-1 px-4 py-3 bg-surface-elevated border border-border rounded-lg text-sm
                     text-white placeholder-steel-600 focus:outline-none focus:border-accent
                     transition-colors disabled:opacity-60"
          maxLength={280}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className="flex items-center justify-center w-12 h-12 bg-gradient-to-r from-accent to-accent-cyan 
                     rounded-lg text-white transition-all hover:shadow-glow disabled:opacity-50"
          disabled={!newComment.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
