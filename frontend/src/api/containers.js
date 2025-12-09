import { apiRequest } from "./client";

export const getContainers = () =>
  apiRequest("/api/containers");

export const getContainerStatus = () =>
  apiRequest("/api/containers/status");

export const createContainer = (data) =>
  apiRequest("/api/containers", {
    method: "POST",
    body: JSON.stringify(data)
  });

export const updateContainer = (id, data) =>
  apiRequest(`/api/containers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });

export const deleteContainer = (id) =>
  apiRequest(`/api/containers/${id}`, {
    method: "DELETE"
  });
