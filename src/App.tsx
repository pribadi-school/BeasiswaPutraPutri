import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { I18nProvider } from './lib/i18n';
import { AccountLayout } from './pages/account/AccountLayout';
import { DashboardPage } from './pages/account/DashboardPage';
import { ProfilePage } from './pages/account/ProfilePage';
import { ResultPage } from './pages/account/ResultPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { AdminPage } from './pages/admin/AdminPage';
import { ApplicantsTab } from './pages/admin/ApplicantsTab';
import { SettingsTab } from './pages/admin/SettingsTab';

export function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="daftar" element={<Navigate to="/masuk" replace />} />
            <Route path="masuk" element={<LoginPage />} />
            <Route path="*" element={<HomePage />} />
          </Route>
          <Route path="admin" element={<AdminPage />}>
            <Route index element={<ApplicantsTab />} />
            <Route path="pengaturan" element={<SettingsTab />} />
          </Route>
          <Route path="akun" element={<AccountLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="data" element={<ProfilePage />} />
            <Route path="pengumuman" element={<ResultPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  );
}
