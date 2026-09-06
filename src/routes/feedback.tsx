import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/feedback")({
  component: function FeedbackRedirect() {
    return <Navigate to="/" />;
  },
});
