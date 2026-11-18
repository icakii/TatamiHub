import { Route, Routes } from 'react-router-dom'
import { PlatformAdminRoute } from './components/PlatformAdminRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HubLayout } from './layouts/HubLayout'
import { Billing } from './pages/Billing'
import { Board } from './pages/Board'
import { Finance } from './pages/Finance'
import { ClubDetail } from './pages/ClubDetail'
import { Clubs } from './pages/Clubs'
import { Login } from './pages/Login'
import { Orders } from './pages/Orders'
import { Signup } from './pages/Signup'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <PlatformAdminRoute>
              <HubLayout />
            </PlatformAdminRoute>
          </ProtectedRoute>
        }
      >
        <Route index element={<Clubs />} />
        <Route path="clubs/:clubId" element={<ClubDetail />} />
        <Route path="billing" element={<Billing />} />
        <Route path="orders" element={<Orders />} />
        <Route path="finance" element={<Finance />} />
        <Route path="board" element={<Board />} />
      </Route>
    </Routes>
  )
}

export default App
