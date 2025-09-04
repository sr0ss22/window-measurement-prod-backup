# AI Development Rules

This document outlines the rules and conventions for the AI to follow when developing this application.

## Tech Stack

This is a web application built with the following technologies:

-   **Framework**: Next.js (using the App Router) with React.
-   **Language**: TypeScript.
-   **Styling**: Tailwind CSS for all styling.
-   **UI Components**: A combination of custom components and primitives from `shadcn/ui`.
-   **State Management**: React Context API for global state, specifically for window measurement data.
-   **Forms**: `react-hook-form` for managing form state and validation.
-   **Icons**: `lucide-react` for all icons.
-   **Notifications**: `sonner` and a custom `useToast` hook for displaying user feedback.
-   **Data Persistence**: Browser `localStorage` is used to save data between sessions.
-   **Image Manipulation**: `react-canvas-draw` is used for image annotation capabilities.

## Development Rules

### File Structure

-   **Pages**: All pages should be created within the `app/` directory. The main page is `app/page.tsx`.
-   **Components**: Reusable components are located in `components/`.
-   **UI Primitives**: Base UI components from `shadcn/ui` are in `components/ui/`. These should generally not be modified directly.
-   **Contexts**: React contexts for state management are in `context/`.
-   **Hooks**: Custom React hooks are located in `hooks/`.
-   **Utilities**: Helper functions are placed in `utils/`.
-   **Types**: TypeScript type definitions reside in `types/`.

### Component Development

-   **Use `shadcn/ui`**: Always prefer using components from the `components/ui/` directory. Do not build custom components if a suitable one already exists.
-   **Styling**: All styling must be done using Tailwind CSS utility classes. Do not write custom CSS unless absolutely necessary for a specific, complex use case.
-   **Responsiveness**: All components must be designed to be responsive and work well on both mobile and desktop screens. Use mobile-first design principles.

### State Management

-   **Use `WindowContext`**: For all state related to window measurements, use the `useWindowContext` hook. This provides access to the list of windows and functions to modify them.
-   **Avoid New State Libraries**: Do not introduce new global state management libraries like Redux or Zustand. Stick to React Context for simplicity.

### Forms and Inputs

-   **Use `react-hook-form`**: All forms should be built using `react-hook-form` and its associated components in `components/ui/form.tsx`.
-   **Measurement Inputs**: For numerical inputs related to measurements (width, height, depth), use the `MeasurementInput` component, which handles rounding to the nearest 1/8".

### Data Handling

-   **Local Storage**: Use the functions provided in `utils/storage-service.ts` (`loadWindowsFromStorage`, `saveWindowsToStorage`, `clearWindowsStorage`) for all interactions with `localStorage`.
-   **Data Export**: For data export functionality (CSV, PDF), utilize the helper functions in `utils/pdf-generator.ts` and the export logic within `components/data-export-import.tsx`.

### User Feedback

-   **Toasts**: Use the `useToast` hook to provide non-blocking feedback to the user for actions like saving, deleting, or exporting data.
-   **Alerts**: Use the `Alert` component for displaying important information or validation errors directly within a component.

By following these rules, we can ensure the codebase remains consistent, maintainable, and easy to work with.