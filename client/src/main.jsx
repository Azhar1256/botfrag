import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { AuthProvider } from './lib/auth.jsx';
import Auth from './pages/Auth.jsx';
import Compose from './pages/Compose.jsx';
import { GamePage, GamesPage } from './pages/Games.jsx';
import Home from './pages/Home.jsx';
import { NotFound, SearchPage, TagPage } from './pages/Listing.jsx';
import PostPage from './pages/PostPage.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route element={<Layout />}>
            <Route index element={<Home key="all" view="all" />} />
            <Route path="following" element={<Home key="following" view="following" />} />
            <Route path="moments" element={<Home key="moment" view="moment" />} />
            <Route path="reviews" element={<Home key="review" view="review" />} />
            <Route path="games" element={<GamesPage />} />
            <Route path="games/:slug" element={<GamePage />} />
            <Route path="p/:id" element={<PostPage />} />
            <Route path="p/:id/edit" element={<Compose />} />
            <Route path="new" element={<Compose />} />
            <Route path="u/:username" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="tags/:tag" element={<TagPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
