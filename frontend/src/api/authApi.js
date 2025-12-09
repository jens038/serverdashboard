// src/api/authApi.js
export async function loginWithCredentials(email, password) {
    // fake response
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          access_token: "dummy-token",
          user: {
            id: 1,
            email,
            name: "Test User",
          },
        });
      }, 500);
    });
  }
  
  export async function fetchCurrentUser() {
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new Error("No token");
    }
    return {
      id: 1,
      email: "test@example.com",
      name: "Test User",
    };
  }
  