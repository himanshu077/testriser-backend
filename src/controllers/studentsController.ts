import { Request, Response } from 'express';
import { db } from '../config/database';
import { users } from '../models/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Get all students with their stats
 */
export const getAllStudents = async (req: Request, res: Response) => {
  try {
    // Get all users with role = 'student'
    const students = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt));

    // TODO: Add stats calculation when test results are available
    // For now, return basic student info
    const studentsWithStats = students.map((student) => ({
      ...student,
      testsAttempted: 0,
      avgScore: 0,
      lastActive: student.updatedAt,
      performance: 'neutral' as const,
    }));

    // Calculate summary stats
    const totalStudents = students.length;
    const activeToday = 0; // TODO: Calculate based on last activity
    const avgScore = 0; // TODO: Calculate from test results
    const testsTaken = 0; // TODO: Calculate from test results

    res.json({
      students: studentsWithStats,
      stats: {
        totalStudents,
        activeToday,
        avgScore,
        testsTaken,
      },
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      message: 'Failed to fetch students',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get student by ID with detailed stats
 */
export const getStudentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const student = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!student || student.role !== 'student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    // TODO: Add detailed stats when test results are available
    const studentWithStats = {
      ...student,
      testsAttempted: 0,
      avgScore: 0,
      lastActive: student.updatedAt,
      performance: 'neutral' as const,
      recentTests: [],
      subjectWiseScores: [],
    };

    res.json(studentWithStats);
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({
      message: 'Failed to fetch student',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
