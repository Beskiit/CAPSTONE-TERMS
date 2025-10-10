import axios from "axios";

const API = import.meta.env.VITE_API_BASE; // <- reads from .env(.production)
export default axios.create({
  baseURL: API,
  withCredentials: true, // keep cookies/sessions
});
