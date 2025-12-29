# Product Overview

This is an event management platform (活动管理平台) designed for Game Jams and similar creative activities. The platform enables event organizers to create, manage, and publish events while allowing participants to browse, register, and participate in activities.

## Core Features

- **User Authentication**: Registration, login, and user management via Supabase Auth
- **Event Management**: Create, edit, publish, and manage events with draft/published states
- **Event Participation**: Browse published events, register for activities, form teams
- **Role-based Access**: Admin users can create/manage events, regular users can participate
- **Team Management**: Create and manage teams for collaborative events
- **Submission System**: Submit work/projects for events with deadline management

## Target Users

- **Event Organizers/Admins**: Create and manage Game Jams and creative events
- **Participants**: Join events, form teams, submit projects
- **Teams**: Collaborate on event submissions and manage team information

## Key Business Logic

- Events have multiple states: draft → published → ended
- Only admins can create and manage events
- Registration and submission periods are time-controlled
- Team formation and management for collaborative events
- Global notification system for user feedback