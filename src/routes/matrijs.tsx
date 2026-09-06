import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/matrijs")({
  component: () => <Navigate to="/matrijsmaker" />,
});
