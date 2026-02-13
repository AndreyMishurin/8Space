import axios from "axios";
import { toast } from "react-hot-toast";
import config from "@/config";

// use this to interact with our own API (/app/api folder) from the front-end side
const apiClient = axios.create({
  baseURL: "/api",
});

apiClient.interceptors.response.use(
  function (response) {
    return response.data;
  },
  function (error) {
    let message = "";

    if (error.response?.status === 401) {
      // User not auth, redirect to login
      toast.error("Please login");
      window.location.href = config.auth.loginUrl;
      return;
    } else if (error.response?.status === 403) {
      message = "Pick a plan to use this feature";
    } else {
      message =
        error?.response?.data?.error || error.message || error.toString();
    }

    error.message =
      typeof message === "string" ? message : JSON.stringify(message);

    console.error(error.message);

    if (error.message) {
      toast.error(error.message);
    } else {
      toast.error("something went wrong...");
    }
    return Promise.reject(error);
  }
);

export default apiClient;
