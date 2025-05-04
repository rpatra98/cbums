"use client";

import { useState, useEffect } from "react";
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  List, 
  ListItem, 
  ListItemText, 
  Avatar, 
  Divider,
  CircularProgress,
  Paper
} from "@mui/material";
import { Comment, Send } from "@mui/icons-material";
import { UserRole } from "@/prisma/enums";

type UserType = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type CommentType = {
  id: string;
  message: string;
  createdAt: string;
  user: UserType;
};

type CommentSectionProps = {
  sessionId: string;
};

export default function CommentSection({ sessionId }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentType[]>([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");

  const fetchComments = async () => {
    setIsFetching(true);
    setError("");
    
    try {
      const response = await fetch(`/api/comments?sessionId=${sessionId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }
      
      const data = await response.json();
      setComments(data);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError("Failed to load comments");
    } finally {
      setIsFetching(false);
    }
  };
  
  useEffect(() => {
    fetchComments();
  }, [sessionId]);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          message: message.trim(),
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to add comment");
      }
      
      const newComment = await response.json();
      setComments((prev) => [newComment, ...prev]);
      setMessage("");
    } catch (err) {
      console.error("Error adding comment:", err);
      setError("Failed to add comment");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Get avatar color based on user role
  const getAvatarColor = (role: string) => {
    switch (role) {
      case UserRole.SUPERADMIN:
        return "#f44336"; // red
      case UserRole.ADMIN:
        return "#3f51b5"; // indigo
      case UserRole.COMPANY:
        return "#4caf50"; // green
      case UserRole.EMPLOYEE:
        return "#ff9800"; // orange
      default:
        return "#9e9e9e"; // gray
    }
  };

  return (
    <Paper sx={{ p: 2, mt: 3 }} variant="outlined">
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Comment color="action" sx={{ mr: 1 }} />
        <Typography variant="h6">Comments</Typography>
      </Box>

      <form onSubmit={handleSendComment}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Add a comment..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
          sx={{ mb: 2 }}
        />
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={!message.trim() || isLoading}
            endIcon={isLoading ? <CircularProgress size={20} /> : <Send />}
          >
            Send
          </Button>
        </Box>
      </form>

      {error && (
        <Typography color="error" sx={{ mt: 2, mb: 2 }}>
          {error}
        </Typography>
      )}

      <List sx={{ mt: 2 }}>
        {isFetching ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress />
          </Box>
        ) : comments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            No comments yet
          </Typography>
        ) : (
          comments.map((comment, index) => (
            <Box key={comment.id}>
              <ListItem alignItems="flex-start">
                <Avatar
                  sx={{ 
                    mr: 2, 
                    bgcolor: getAvatarColor(comment.user.role),
                    width: 36,
                    height: 36
                  }}
                >
                  {getInitials(comment.user.name)}
                </Avatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography component="span" variant="subtitle2">
                        {comment.user.name}
                      </Typography>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {formatDate(comment.createdAt)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.primary"
                        sx={{ display: "block", mt: 1 }}
                      >
                        {comment.message}
                      </Typography>
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5 }}
                      >
                        {comment.user.role}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
              {index < comments.length - 1 && <Divider variant="inset" component="li" />}
            </Box>
          ))
        )}
      </List>
    </Paper>
  );
} 