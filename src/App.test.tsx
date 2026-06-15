import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute } from './App';
import { useAuthStore } from '@/store/auth';

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div>Home page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>Admin page</div>
            </AdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminRoute', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it('redirects an authenticated non-admin user', () => {
    useAuthStore.setState({
      user: { id: 1, username: 'user', role: 'user' },
      isAuthenticated: true,
    });

    renderAdminRoute();

    expect(screen.getByText('Home page')).toBeInTheDocument();
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument();
  });

  it('renders the protected page for an administrator', () => {
    useAuthStore.setState({
      user: { id: 2, username: 'admin', role: 'admin' },
      isAuthenticated: true,
    });

    renderAdminRoute();

    expect(screen.getByText('Admin page')).toBeInTheDocument();
  });
});
