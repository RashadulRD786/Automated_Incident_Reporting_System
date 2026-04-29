import { Navigate } from 'react-router-dom';

function isTokenValid(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!isTokenValid(token)) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
