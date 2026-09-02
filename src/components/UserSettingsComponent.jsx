// UserSettingsComponent.js
import React from 'react';

const defaultIcons = {
  userCog:
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS11c2VyLWNvZy1pY29uIGx1Y2lkZS11c2VyLWNvZyI+PHBhdGggZD0iTTEwIDE1SDZhNCA0IDAgMCAwLTQgNHYyIi8+PHBhdGggZD0ibTE0LjMwNSAxNi41My45MjMtLjM4MiIvPjxwYXRoIGQ9Im0xNS4yMjggMTMuODUyLS45MjMtLjM4MyIvPjxwYXRoIGQ9Im0xNi44NTIgMTIuMjI4LS4zODMtLjkyMyIvPjxwYXRoIGQ9Im0xNi44NTIgMTcuNzcyLS4zODMuOTI0Ii8+PHBhdGggZD0ibTE5LjE0OCAxMi4yMjguMzgzLS45MjMiLz48cGF0aCBkPSJtMTkuNTMgMTguNjk2LS4zODItLjkyNCIvPjxwYXRoIGQ9Im0yMC43NzIgMTMuODUyLjkzNC0uMzgzIi8+PHBhdGggZD0ibTIwLjc3MiAxNi4xNDguOTI0LjM4MyIvPjxjaXJjbGUgY3g9IjE4IiBjeT0iMTUiIHI9IjMiLz48Y2lyY2xlIGN4PSI5IiBjeT0iNyIgcj0iNCIvPjwvc3ZnPg==',
};

const UserSettingsComponent = ({ onCardClick }) => {
  return (
    <div className="bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 p-16 text-center cursor-pointer hover:bg-white/10 transition-all duration-300">
      <div className="flex justify-center mb-8">
        <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
          <img
            src={defaultIcons.userCog}
            alt="User Settings Icon"
            className="w-14 h-14"
          />
        </div>
      </div>
      <h2 className="text-5xl font-bold text-neutral-200 mb-6">User Settings</h2>
      <p className="text-white/80 mb-10 text-xl">
        Manage your account and preferences
      </p>
    </div>
  );
};

export default UserSettingsComponent;
