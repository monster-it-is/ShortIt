import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Home from './pages/Home'
import LinkPage from './pages/LinkPage'
import { useAuth } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'

function ProtectedHome() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className='flex h-svh w-full items-center justify-center px-4 text-muted-foreground' role='status'>
        Checking session...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to='/' replace />
  }

  return <Home />
}

function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path='/' element={<Landing/>}/>
        <Route path='/home' element={<ProtectedHome/>}/>
        <Route path='/:slug' element={<LinkPage/>}/>
      </Routes>
    </ThemeProvider>
  )
}

export default App
