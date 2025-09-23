/**
 * Basic Usage Examples for Notification Service SDK
 *
 * This file demonstrates common usage patterns and features
 * of the Notification Service JavaScript/TypeScript SDK.
 */

import {
  NotificationClient,
  isRateLimitError,
  isValidationError,
  isAuthenticationError,
  NotificationChannel,
  NotificationPriority
} from '../src';

// Initialize the client
const client = new NotificationClient({
  baseURL: 'https://api.notification.example.com/api',
  apiKey: 'nf_your_api_key_here', // Replace with your actual API key
  timeout: 30000,
  retry: {
    attempts: 3,
    delay: 1000,
    retryOnRateLimit: true
  }
});

/**
 * Example 1: Send a simple text message
 */
async function sendSimpleMessage() {
  try {
    const response = await client.sendNotification({
      channel: 'telegram',
      recipient: '@username',
      message: 'Hello! This is a test notification from the SDK.',
      priority: 'medium'
    });

    console.log('✅ Notification sent successfully!');
    console.log('Notification ID:', response.data.id);
    console.log('Status:', response.data.status);

    // Check rate limit information
    if (response.rateLimit) {
      console.log(`Rate limit: ${response.rateLimit.remaining}/${response.rateLimit.limit}`);
    }

  } catch (error) {
    console.error('❌ Failed to send notification:', error.message);
  }
}

/**
 * Example 2: Send notification using a template
 */
async function sendWithTemplate() {
  try {
    const response = await client.sendNotification({
      channel: 'telegram',
      recipient: '@jobseeker',
      template: '550e8400-e29b-41d4-a716-446655440000', // Replace with actual template ID
      data: {
        title: 'Senior Backend Developer',
        company: 'TechCorp Inc.',
        location: 'Tehran, Iran',
        salary: '$80,000 - $120,000',
        description: 'We are looking for an experienced backend developer...',
        url: 'https://jobs.techcorp.com/backend-senior'
      },
      priority: 'high',
      metadata: {
        source: 'job-board',
        campaign: 'weekly-digest'
      }
    });

    console.log('✅ Template notification sent!');
    console.log('Notification ID:', response.data.id);

  } catch (error) {
    console.error('❌ Failed to send template notification:', error.message);
  }
}

/**
 * Example 3: Schedule a notification for future delivery
 */
async function scheduleNotification() {
  try {
    // Schedule for Christmas Day
    const christmasDate = new Date('2024-12-25T10:00:00Z');

    const response = await client.scheduleNotification({
      channel: 'telegram',
      recipient: '@username',
      message: '🎄 Merry Christmas! Hope you have a wonderful day!',
      scheduledAt: christmasDate,
      priority: 'low'
    });

    console.log('✅ Notification scheduled successfully!');
    console.log('Notification ID:', response.data.id);
    console.log('Scheduled for:', response.data.scheduledAt);

  } catch (error) {
    console.error('❌ Failed to schedule notification:', error.message);
  }
}

/**
 * Example 4: Send batch notifications
 */
async function sendBatchNotifications() {
  try {
    const response = await client.sendBatchNotifications({
      channel: 'telegram',
      template: 'job-alert-template-id',
      notifications: [
        {
          recipient: '@developer1',
          data: {
            title: 'Frontend Developer',
            company: 'StartupXYZ',
            location: 'Remote'
          }
        },
        {
          recipient: '@developer2',
          data: {
            title: 'Backend Developer',
            company: 'BigTech Corp',
            location: 'San Francisco'
          }
        },
        {
          recipient: '@developer3',
          data: {
            title: 'Full Stack Developer',
            company: 'ScaleUp Ltd',
            location: 'London'
          }
        }
      ],
      options: {
        batchSize: 10,
        delayBetween: 2000,
        deduplicate: true
      }
    });

    console.log('✅ Batch notifications processed!');
    console.log(`Total: ${response.data.summary.total}`);
    console.log(`Successful: ${response.data.summary.successful}`);
    console.log(`Failed: ${response.data.summary.failed}`);

    // Log individual results
    response.data.results.forEach((result, index) => {
      if (result.status === 'queued') {
        console.log(`  ${index + 1}. ${result.recipient}: ✅ Queued (ID: ${result.id})`);
      } else {
        console.log(`  ${index + 1}. ${result.recipient}: ❌ Failed (${result.error})`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to send batch notifications:', error.message);
  }
}

/**
 * Example 5: Query and filter notifications
 */
async function queryNotifications() {
  try {
    // Get recent sent notifications
    const response = await client.getNotifications({
      status: 'sent',
      channel: 'telegram',
      priority: 'high',
      from: new Date('2024-01-01'),
      limit: 20
    });

    console.log(`✅ Found ${response.data.notifications.length} notifications`);

    response.data.notifications.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.id} - ${notification.status} (${notification.createdAt})`);
    });

    console.log(`\nPagination: ${response.data.pagination.offset}-${response.data.pagination.limit} of ${response.data.pagination.total}`);

  } catch (error) {
    console.error('❌ Failed to query notifications:', error.message);
  }
}

/**
 * Example 6: Get notification details and history
 */
async function getNotificationDetails(notificationId: string) {
  try {
    // Get notification details
    const notification = await client.getNotification(notificationId);
    console.log('✅ Notification details:', {
      id: notification.data.id,
      status: notification.data.status,
      channel: notification.data.channel,
      recipient: notification.data.recipient,
      createdAt: notification.data.createdAt,
      sentAt: notification.data.sentAt
    });

    // Get delivery history
    const history = await client.getNotificationHistory(notificationId);
    console.log('\n📋 Delivery History:');
    console.log(`Attempts: ${history.data.attempts}/${history.data.maxRetries}`);

    history.data.history.forEach((attempt, index) => {
      const status = attempt.status === 'success' ? '✅' : '❌';
      console.log(`  ${index + 1}. ${status} ${attempt.status} (${attempt.timestamp})`);
      if (attempt.errorMessage) {
        console.log(`     Error: ${attempt.errorMessage}`);
      }
    });

  } catch (error) {
    console.error('❌ Failed to get notification details:', error.message);
  }
}

/**
 * Example 7: Get notification statistics
 */
async function getNotificationStats() {
  try {
    const response = await client.getStats({
      from: new Date('2024-01-01'),
      to: new Date()
    });

    console.log('📊 Notification Statistics:');
    console.log(`Total: ${response.data.summary.total}`);
    console.log(`Sent: ${response.data.summary.sent}`);
    console.log(`Failed: ${response.data.summary.failed}`);
    console.log(`Pending: ${response.data.summary.pending}`);
    console.log(`Success Rate: ${response.data.summary.successRate}%`);

    console.log('\n📈 By Channel:');
    Object.entries(response.data.byChannel).forEach(([channel, stats]) => {
      console.log(`  ${channel}: ${stats.sent}/${stats.total} sent (${Math.round((stats.sent / stats.total) * 100)}%)`);
    });

  } catch (error) {
    console.error('❌ Failed to get statistics:', error.message);
  }
}

/**
 * Example 8: Advanced error handling
 */
async function advancedErrorHandling() {
  try {
    await client.sendNotification({
      channel: 'invalid-channel' as NotificationChannel, // This will cause a validation error
      recipient: '',
      message: ''
    });

  } catch (error) {
    console.log('🔍 Demonstrating error handling:');

    if (isValidationError(error)) {
      console.log('❌ Validation Error:');
      error.validationErrors.forEach(err => {
        console.log(`  - ${err.field}: ${err.message} (value: "${err.value}")`);
      });

    } else if (isRateLimitError(error)) {
      console.log('⏳ Rate Limited:');
      console.log(`  Retry after: ${error.retryAfter} seconds`);
      if (error.rateLimit) {
        console.log(`  Rate limit: ${error.rateLimit.remaining}/${error.rateLimit.limit}`);
        console.log(`  Resets at: ${error.rateLimit.resetTime}`);
      }

    } else if (isAuthenticationError(error)) {
      console.log('🔐 Authentication Error:');
      console.log('  Check your API key or JWT token');

    } else {
      console.log('💥 Unexpected Error:');
      console.log(`  ${error.name}: ${error.message}`);
    }
  }
}

/**
 * Example 9: Health check
 */
async function checkServiceHealth() {
  try {
    const response = await client.health();

    if (response.data.status === 'ok') {
      console.log('✅ Service is healthy');
      console.log(`Service: ${response.data.service} v${response.data.version}`);
      console.log(`Checked at: ${response.data.timestamp}`);
    } else {
      console.log('⚠️ Service health check failed');
    }

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

/**
 * Example 10: Cancel a notification
 */
async function cancelNotification(notificationId: string) {
  try {
    const response = await client.cancelNotification(notificationId);

    console.log('✅ Notification cancelled successfully');
    console.log(`ID: ${response.data.id}`);
    console.log(`Status: ${response.data.status}`);

  } catch (error) {
    console.error('❌ Failed to cancel notification:', error.message);
  }
}

/**
 * Main function to run examples
 */
async function runExamples() {
  console.log('🚀 Notification Service SDK Examples\n');

  try {
    // Check service health first
    await checkServiceHealth();
    console.log('');

    // Example 1: Simple message
    console.log('📤 Example 1: Sending simple message...');
    await sendSimpleMessage();
    console.log('');

    // Example 2: Template message
    console.log('📋 Example 2: Sending with template...');
    await sendWithTemplate();
    console.log('');

    // Example 3: Schedule notification
    console.log('⏰ Example 3: Scheduling notification...');
    await scheduleNotification();
    console.log('');

    // Example 4: Batch notifications
    console.log('📦 Example 4: Sending batch notifications...');
    await sendBatchNotifications();
    console.log('');

    // Example 5: Query notifications
    console.log('🔍 Example 5: Querying notifications...');
    await queryNotifications();
    console.log('');

    // Example 6: Get statistics
    console.log('📊 Example 6: Getting statistics...');
    await getNotificationStats();
    console.log('');

    // Example 7: Error handling
    console.log('🛠️ Example 7: Error handling...');
    await advancedErrorHandling();
    console.log('');

  } catch (error) {
    console.error('💥 Example execution failed:', error.message);
  }
}

// Uncomment to run examples
// runExamples();

// Export functions for individual testing
export {
  sendSimpleMessage,
  sendWithTemplate,
  scheduleNotification,
  sendBatchNotifications,
  queryNotifications,
  getNotificationDetails,
  getNotificationStats,
  advancedErrorHandling,
  checkServiceHealth,
  cancelNotification,
  runExamples
};