import { Request, Response } from 'express';
import { db } from '../config/database';
import { contactMessages } from '../models/schema';
import { eq, desc } from 'drizzle-orm';
import { HTTP_STATUS } from '../config/constants';

/**
 * Submit contact form
 * @route POST /api/contact
 */
export async function submitContactForm(req: Request, res: Response) {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Missing required fields',
        required: ['name', 'email', 'subject', 'message'],
      });
    }

    const [newMessage] = await db
      .insert(contactMessages)
      .values({
        name,
        email,
        phone,
        subject,
        message,
      })
      .returning();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.',
      data: {
        id: newMessage.id,
      },
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to submit contact form',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get all contact messages (admin only)
 * @route GET /api/admin/contact-messages
 */
export async function getAllContactMessages(req: Request, res: Response) {
  try {
    const messages = await db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt));

    res.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to fetch contact messages',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Mark message as read (admin only)
 * @route PUT /api/admin/contact-messages/:id/read
 */
export async function markMessageAsRead(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [updatedMessage] = await db
      .update(contactMessages)
      .set({
        isRead: true,
      })
      .where(eq(contactMessages.id, id))
      .returning();

    if (!updatedMessage) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Message not found',
      });
    }

    res.json({
      success: true,
      message: 'Message marked as read',
      data: updatedMessage,
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to mark message as read',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Delete contact message (admin only)
 * @route DELETE /api/admin/contact-messages/:id
 */
export async function deleteContactMessage(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [deletedMessage] = await db
      .delete(contactMessages)
      .where(eq(contactMessages.id, id))
      .returning();

    if (!deletedMessage) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: 'Message not found',
      });
    }

    res.json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(HTTP_STATUS.SERVER_ERROR).json({
      error: 'Failed to delete message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
