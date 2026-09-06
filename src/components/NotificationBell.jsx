import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const wrapperRef = useRef(null);

  async function loadNotifications() {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error(`Failed to load notifications: ${error.message}`);
      return;
    }
    setItems(data ?? []);
  }

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 20000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const unreadCount = items.filter((n) => !n.is_read).length;

  async function handleOpenNotification(notification) {
    if (!notification.is_read) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
      if (error) console.error(`Failed to mark notification read: ${error.message}`);
      setItems((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }
    setOpen(false);
    navigate(`/case/${notification.person_id}?highlight=${notification.sighting_id}`);
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          color: '#fff',
        }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              background: '#2fa84f',
              color: '#fff',
              borderRadius: '999px',
              fontSize: '10px',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '36px',
            width: '320px',
            maxHeight: '360px',
            overflowY: 'auto',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(13,40,24,0.18)',
            zIndex: 50,
          }}
        >
          {items.length === 0 ? (
            <div style={{ padding: '16px', color: '#6b8377', fontSize: '14px' }}>
              No notifications yet.
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleOpenNotification(n)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 14px',
                  border: 'none',
                  borderBottom: '1px solid #eaf5ec',
                  background: n.is_read ? '#fff' : '#f4f7f5',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: n.is_read ? 400 : 600, color: '#12261c', fontSize: '13px' }}>
                  {n.title}
                </div>
                <div style={{ color: '#6b8377', fontSize: '12px', marginTop: '4px' }}>
                  {n.body}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}