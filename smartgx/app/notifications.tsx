import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useNotificationStore } from "../src/store/notificationStore";
import type { AppNotification } from "../src/types/notification";
import { colors } from "../src/theme/colors";
import { radius } from "../src/theme/radius";
import { spacing } from "../src/theme/spacing";
import { typography } from "../src/theme/typography";

/* ─── Type metadata ───────────────────────────────────────────────── */

const TYPE_META: Record<
  AppNotification["type"],
  { color: string; bg: string; icon: React.ReactNode }
> = {
  info: {
    color: "#A78BFA",
    bg:    "rgba(167,139,250,0.12)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z" stroke="#A78BFA" strokeWidth="1.8" />
        <Path d="M12 8V12M12 16H12.01" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    ),
  },
  alert: {
    color: "#F59E0B",
    bg:    "rgba(245,158,11,0.12)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M10.29 3.86L1.82 18C1.64 18.32 1.55 18.68 1.55 19.04C1.55 20.13 2.43 21 3.52 21H20.48C21.57 21 22.45 20.13 22.45 19.04C22.45 18.68 22.36 18.32 22.18 18L13.71 3.86C13.17 2.95 11.83 2.95 11.29 3.86L10.29 3.86Z" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 9V13M12 17H12.01" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    ),
  },
  insight: {
    color: "#38BDF8",
    bg:    "rgba(56,189,248,0.12)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L13.09 8.26L19 6L15.45 11.09L21 13L15.45 14.91L19 20L13.09 17.74L12 24L10.91 17.74L5 20L8.55 14.91L3 13L8.55 11.09L5 6L10.91 8.26L12 2Z" stroke="#38BDF8" strokeWidth="1.5" strokeLinejoin="round" />
      </Svg>
    ),
  },
  security: {
    color: "#22C55E",
    bg:    "rgba(34,197,94,0.12)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22C12 22 4 18 4 12V5L12 2L20 5V12C20 18 12 22 12 22Z" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M9 12L11 14L15 10" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  risk: {
    color: "#EF4444",
    bg: "rgba(239,68,68,0.14)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L22 20H2L12 2Z" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 9V13M12 17H12.01" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    ),
  },
  success: {
    color: "#4ADE80",
    bg: "rgba(74,222,128,0.12)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22Z" stroke="#4ADE80" strokeWidth="1.8" />
        <Path d="M9 12L11 14L15 10" stroke="#4ADE80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    ),
  },
  warning: {
    color: "#FBBF24",
    bg: "rgba(251,191,36,0.12)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M10.29 3.86L1.82 18C1.55 18.62 2.43 21 4 21H20C21.57 21 22.45 18.62 22.18 18L13.71 3.86C13.17 2.95 11.83 2.95 11.29 3.86H10.29Z" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 9V13M12 17H12.01" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    ),
  },
  reward: {
    color: "#C4B5FD",
    bg: "rgba(196,181,253,0.12)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" stroke="#C4B5FD" strokeWidth="1.6" strokeLinejoin="round" />
      </Svg>
    ),
  },
  campaign: {
    color: "#38BDF8",
    bg: "rgba(56,189,248,0.12)",
    icon: (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    ),
  },
};

/* ─── Screen ──────────────────────────────────────────────────────── */

export default function NotificationsScreen() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } =
    useNotificationStore();

  const hasNotifications = notifications.length > 0;

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0F0529" />

      {/* ── Header (two rows on small screens so bulk actions stay visible) ── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            style={styles.backBtn}
            onPress={() => router.push("/dashboard" as never)}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18L9 12L15 6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>

          <View style={styles.headerTitleBlock}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Notifications
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
              </View>
            )}
          </View>
        </View>

        {hasNotifications ? (
          <View style={styles.headerActionsRow}>
            {unreadCount > 0 ? (
              <Pressable style={[styles.headerActionBtn, styles.headerActionBtnGrow]} onPress={markAllAsRead}>
                <Text style={styles.headerActionText} numberOfLines={1}>
                  Read all
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.headerActionBtn, styles.clearAllBtn, styles.headerActionBtnGrow]} onPress={clearAll}>
              <Text style={[styles.headerActionText, styles.clearAllText]} numberOfLines={1}>
                Clear all
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {!hasNotifications ? (
          /* ── Empty state ── */
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                <Path d="M18 8C18 6.4 17.4 4.8 16.2 3.6C15 2.4 13.5 2 12 2C10.5 2 9 2.4 7.8 3.6C6.6 4.8 6 6.4 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M13.73 21C13.55 21.3 13.3 21.55 12.99 21.72C12.68 21.9 12.34 21.99 12 21.99C11.66 21.99 11.32 21.9 11.01 21.72C10.7 21.55 10.45 21.3 10.27 21" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyHint}>
              SmartGX will notify you about account activity, security alerts, and financial insights.
            </Text>
          </View>
        ) : (
          /* ── Notification list ── */
          <View style={styles.list}>
            {notifications.map((notif) => {
              const meta = TYPE_META[notif.type];
              return (
                <Pressable
                  key={notif.id}
                  style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
                  onPress={() => markAsRead(notif.id)}
                >
                  {/* Icon */}
                  <View style={[styles.notifIconWrap, { backgroundColor: meta.bg }]}>
                    {meta.icon}
                  </View>

                  {/* Body */}
                  <View style={styles.notifBody}>
                    <View style={styles.notifTitleRow}>
                      <Text style={styles.notifTitle} numberOfLines={1}>
                        {notif.title}
                      </Text>
                      {!notif.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifMessage} numberOfLines={2}>
                      {notif.message}
                    </Text>
                    <Text style={styles.notifTime}>{notif.time}</Text>
                  </View>

                  {/* Delete button */}
                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => deleteNotification(notif.id)}
                    hitSlop={8}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6L18 18" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" />
                    </Svg>
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}

        {hasNotifications && (
          <Text style={styles.footerNote}>Tap to mark as read · × to delete</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  /* Header */
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 40,
  },
  backBtn: { padding: 4 },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  headerTitle: { color: "#FFFFFF", fontSize: typography.title, fontWeight: "800", flexShrink: 1 },
  unreadBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(167,139,250,0.18)",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.3)",
    flexShrink: 0,
  },
  unreadBadgeText: { color: "#A78BFA", fontSize: 11, fontWeight: "700" },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "nowrap",
    paddingLeft: 36,
  },
  headerActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 36,
    justifyContent: "center",
  },
  headerActionBtnGrow: { flex: 1, minWidth: 0 },
  headerActionText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textAlign: "center" },
  clearAllBtn: { borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.06)" },
  clearAllText: { color: "#EF4444" },

  /* Scroll */
  scrollContent: { paddingBottom: 48, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md, flexGrow: 1 },

  /* Empty */
  emptyState:   { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  emptyTitle:   { color: "#FFFFFF", fontSize: typography.subheading, fontWeight: "700", textAlign: "center" },
  emptyHint:    { color: colors.textMuted, fontSize: typography.body, textAlign: "center", lineHeight: 22 },

  /* List */
  list: { gap: 1, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  notifItem: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  notifItemUnread: { backgroundColor: "rgba(109, 40, 217, 0.06)" },
  notifIconWrap:   { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  notifBody:       { flex: 1, gap: 4 },
  notifTitleRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  notifTitle:      { color: "#FFFFFF", fontSize: typography.body, fontWeight: "700", flex: 1 },
  unreadDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#A78BFA", flexShrink: 0 },
  notifMessage:    { color: colors.textSecondary, fontSize: typography.caption, lineHeight: 18 },
  notifTime:       { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  deleteBtn:       { width: 28, height: 28, alignItems: "center", justifyContent: "center", marginLeft: 4, flexShrink: 0 },

  footerNote: { color: colors.textMuted, fontSize: 11, textAlign: "center", paddingTop: spacing.sm },
});
