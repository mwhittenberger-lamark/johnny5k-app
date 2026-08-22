/* eslint-disable react-refresh/only-export-components */
import { lazy } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppBootstrapLayout } from './App'
import { AppShellErrorElement } from './app/routing/AppShellErrorElement'
import { LazyRoute } from './app/routing/LazyRoute'
import { RequireAdminLayout } from './app/routing/RequireAdminLayout'
import { RequireOnboardedLayout } from './app/routing/RequireOnboardedLayout'
import { RootLayout } from './app/routing/RootLayout'
import { ShellLayout } from './app/routing/ShellLayout'
import RouteErrorScreen from './components/resilience/RouteErrorScreen'

const LoginScreen = lazy(() => import('./screens/auth/LoginScreen'))
const RegisterScreen = lazy(() => import('./screens/auth/RegisterScreen'))
const ForgotPasswordScreen = lazy(() => import('./screens/auth/ForgotPasswordScreen'))
const ResetPasswordScreen = lazy(() => import('./screens/auth/ResetPasswordScreen'))
const HomeScreen = lazy(() => import('./screens/HomeScreen'))
const Nat20HomeScreen = lazy(() => import('./screens/nat20/Nat20HomeScreen'))
const WorkoutScreen = lazy(() => import('./screens/workout/WorkoutScreen'))
const ExerciseLibraryScreen = lazy(() => import('./screens/workout/ExerciseLibraryScreen'))
const NutritionScreen = lazy(() => import('./screens/nutrition/NutritionScreen'))
const ShoppingListScreen = lazy(() => import('./screens/nutrition/ShoppingListScreen'))
const BodyScreen = lazy(() => import('./screens/body/BodyScreen'))
const ActivityLogScreen = lazy(() => import('./screens/activity/ActivityLogScreen'))
const AiScreen = lazy(() => import('./screens/ai/AiScreen'))
const AdminScreen = lazy(() => import('./screens/admin/AdminScreen'))
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen'))
const ProgressPhotosScreen = lazy(() => import('./screens/progress/ProgressPhotosScreen'))
const RewardsScreen = lazy(() => import('./screens/rewards/RewardsScreen'))
const IronQuestScreen = lazy(() => import('./screens/ironquest/IronQuestScreen'))
const IronQuestOnboardingFlow = lazy(() => import('./screens/onboarding/IronQuestOnboardingFlow'))
const IronQuestMapScreen = lazy(() => import('./screens/ironquest/IronQuestMapScreen'))
const IronQuestCharacterSheetScreen = lazy(() => import('./screens/ironquest/IronQuestCharacterSheetScreen'))
const IronQuestStoreScreen = lazy(() => import('./screens/ironquest/IronQuestStoreScreen'))
const Nat20SetupScreen = lazy(() => import('./screens/nat20/Nat20SetupScreen'))

function lazyElement(routeComponent) {
  const RouteComponent = routeComponent

  return (
    <LazyRoute>
      <RouteComponent />
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
            element: <RequireOnboardedLayout />,
            errorElement: <AppShellErrorElement />,
            children: [
              {
                path: '/nat20',
                element: lazyElement(Nat20HomeScreen),
                errorElement: <RouteErrorScreen area="Nat20 dashboard" />,
              },
              {
                path: '/nat20/setup',
                element: lazyElement(Nat20SetupScreen),
                errorElement: <RouteErrorScreen area="Nat20 setup" />,
              },
              {
                element: <ShellLayout />,
                errorElement: <AppShellErrorElement />,
                children: [
                  {
                    index: true,
                    element: lazyElement(HomeScreen),
                    errorElement: <RouteErrorScreen area="dashboard" />,
                  },
                  {
                    path: '/dashboard',
                    element: lazyElement(HomeScreen),
                    errorElement: <RouteErrorScreen area="dashboard" />,
                  },
                  {
                    path: '/workout',
                    element: lazyElement(WorkoutScreen),
                    errorElement: <RouteErrorScreen area="workout" />,
                  },
                  {
                    path: '/workout/live',
                    element: lazyElement(WorkoutScreen),
                    errorElement: <RouteErrorScreen area="live workout" />,
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
                    path: '/shopping-list',
                    element: lazyElement(ShoppingListScreen),
                    errorElement: <RouteErrorScreen area="shopping list" />,
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
                    path: '/ironquest',
                    element: lazyElement(IronQuestScreen),
                    errorElement: <RouteErrorScreen area="dashboard" />,
                  },
                  {
                    path: '/ironquest/setup/*',
                    element: lazyElement(IronQuestOnboardingFlow),
                    errorElement: <RouteErrorScreen area="dashboard" />,
                  },
                  {
                    path: '/ironquest/map',
                    element: lazyElement(IronQuestMapScreen),
                    errorElement: <RouteErrorScreen area="dashboard" />,
                  },
                  {
                    path: '/ironquest/character',
                    element: lazyElement(IronQuestCharacterSheetScreen),
                    errorElement: <RouteErrorScreen area="dashboard" />,
                  },
                  {
                    path: '/ironquest/store',
                    element: lazyElement(IronQuestStoreScreen),
                    errorElement: <RouteErrorScreen area="dashboard" />,
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
                  {
                    path: '/admin/ironquest',
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
