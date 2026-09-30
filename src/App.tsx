import { Route, Routes } from 'react-router-dom'
import { PlatformAdminRoute } from './components/PlatformAdminRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { HubLayout } from './layouts/HubLayout'
import { ClubDetail } from './pages/ClubDetail'
import { Clubs } from './pages/Clubs'
import { Login } from './pages/Login'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
      </Route>
    </Routes>
  )
}

export default App
