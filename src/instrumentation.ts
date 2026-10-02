export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAttendanceReminderScheduler } = await import('@/lib/services/compliance-scheduler');
    startAttendanceReminderScheduler();
  }
}
