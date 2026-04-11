import { lazy } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import {
  AppBootstrapLayout,
  AppShellErrorElement,
  LazyRoute,
  RequireAdminLayout,
  RequireAuthLayout,
  RequireOnboardedLayout,
  RootLayout,
  ShellLayout,
} from './App'
import RouteErrorScreen from './components/resilience/RouteErrorScreen'

const LoginScreen = lazy(() => import('./screens/auth/LoginScreen'))
const RegisterScreen = lazy(() => import('./screens/auth/RegisterScreen'))
const ForgotPasswordScreen = lazy(() => import('./screens/auth/ForgotPasswordScreen'))
const ResetPasswordScreen = lazy(() => import('./screens/auth/ResetPasswordScreen'))
const OnboardingRoutes = lazy(() => import('./screens/onboarding/OnboardingRoutes'))
const DashboardScreen = lazy(() => import('./screens/dashboard/DashboardScreen'))
const WorkoutScreen = lazy(() => import('./screens/workout/WorkoutScreen'))
const ExerciseLibraryScreen = lazy(() => import('./screens/workout/ExerciseLibraryScreen'))
const NutritionScreen = lazy(() => import('./screens/nutrition/NutritionScreen'))
const BodyScreen = lazy(() => import('./screens/body/BodyScreen'))
const ActivityLogScreen = lazy(() => import('./screens/activity/ActivityLogScreen'))
const AiScreen = lazy(() => import('./screens/ai/AiScreen'))
const AdminScreen = lazy(() => import('./screens/admin/AdminScreen'))
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen'))
const ProgressPhotosScreen = lazy(() => import('./screens/progress/ProgressPhotosScreen'))
const RewardsScreen = lazy(() => import('./screens/rewards/RewardsScreen'))

function lazyElement(Component) {
  return (
    <LazyRoute>
      <Component />
    </LazyRoute>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorScreen area="app" />,
    children: [
      {
        element: <AppBootstrapLayout />,
        errorElement: <RouteErrorScreen area="app" />,
        children: [
          {
            element: <Outlet />,
            errorElement: <RouteErrorScreen area="auth" />,
            children: [
              {
                path: '/login',
                element: lazyElement(LoginScreen),
              },
              {
                path: '/register',
                element: lazyElement(RegisterScreen),
              },
              {
                path: '/forgot-password',
                element: lazyElement(ForgotPasswordScreen),
              },
              {
                path: '/reset-password',
                element: lazyElement(ResetPasswordScreen),
              },
            ],
          },
          {
            element: <RequireAuthLayout />,
            errorElement: <RouteErrorScreen area="onboarding" />,
            children: [
              {
                path: '/onboarding/*',
                element: lazyElement(OnboardingRoutes),
              },
            ],
          },
          {
            element: <RequireOnboardedLayout />,
            errorElement: <AppShellErrorElement />,
            children: [
              {
                element: <ShellLayout />,
                errorElement: <AppShellErrorElement />,
                children: [
                  {
                    index: true,
                    element: lazyElement(DashboardScreen),
                    errorElement: <RouteErrorScreen area="dashboard" />,
                  },
                  {
                    path: '/dashboard',
                    element: lazyElement(DashboardScreen),
                    errorElement: <RouteErrorScreen area="dashboard" />,
                  },
                  {
                    path: '/workout',
                    element: lazyElement(WorkoutScreen),
                    errorElement: <RouteErrorScreen area="workout" />,
                  },
                  {
                    path: '/workout/library',
                    element: lazyElement(ExerciseLibraryScreen),
                    errorElement: <RouteErrorScreen area="workout" />,
                  },
                  {
                    path: '/nutrition/*',
                    element: lazyElement(NutritionScreen),
                    errorElement: <RouteErrorScreen area="nutrition" />,
                  },
                  {
                    path: '/body',
                    element: lazyElement(BodyScreen),
                    errorElement: <RouteErrorScreen area="body" />,
                  },
                  {
                    path: '/activity-log',
                    element: lazyElement(ActivityLogScreen),
                    errorElement: <RouteErrorScreen area="activity" />,
                  },
                  {
                    path: '/progress-photos',
                    element: lazyElement(ProgressPhotosScreen),
                    errorElement: <RouteErrorScreen area="body" />,
                  },
                  {
                    path: '/rewards',
                    element: lazyElement(RewardsScreen),
                    errorElement: <RouteErrorScreen area="rewards" />,
                  },
                  {
                    path: '/ai',
                    element: lazyElement(AiScreen),
                    errorElement: <RouteErrorScreen area="app" />,
                  },
                  {
                    path: '/settings',
                    element: lazyElement(SettingsScreen),
                    errorElement: <RouteErrorScreen area="settings" />,
                  },
                ],
              },
            ],
          },
          {
            element: <RequireAdminLayout />,
            errorElement: <RouteErrorScreen area="admin" />,
            children: [
              {
                element: <ShellLayout />,
                errorElement: <RouteErrorScreen area="admin" />,
                children: [
                  {
                    path: '/admin',
                    element: lazyElement(AdminScreen),
                    errorElement: <RouteErrorScreen area="admin" />,
                  },
                ],
              },
            ],
          },
          {
            path: '*',
            element: <Navigate to="/dashboard" replace />,
          },
        ],
      },
    ],
  },
])