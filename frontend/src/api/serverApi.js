// src/api/serverApi.js
import { apiRequest } from "./client";

export function fetchServerStats() {
  return apiRequest("/server/stats");
}

export function fetchContainers() {
  return apiRequest("/server/containers");
}

export function restartContainer(id) {
  return apiRequest(`/server/containers/${id}/restart`, {
    method: "POST",
  });
}
