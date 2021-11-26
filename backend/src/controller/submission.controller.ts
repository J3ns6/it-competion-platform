import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Submission as SubmissionModel,
} from '@prisma/client';
import { getSubmissionRating } from 'src/submissionRating';

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get(':id')
  async getSubmissionById(@Param('id') id: string): Promise<object> {
    return await this.prismaService.submission.findUnique({
      where: {
        id: Number(id),
      },
    });
  }

  @Put(':id')
  async updateSubmission(
    @Param('id') id: string,
    @Body()
    submissionData: {
      content: string;
      description: string;
    },
  ): Promise<SubmissionModel> {
    const { content, description } = submissionData;
    return this.prismaService.submission.update({
      where: { id: Number(id) },
      data: {
        content,
        description,
      },
    });
  }

  @Post()
  async createSubmission(
    @Body()
    submissionData: {
      content: string;
      description: string;
      userId: number;
      competitionId: number;
    },
  ): Promise<SubmissionModel | object> {
    const { content, description, userId, competitionId } = submissionData;
    try {
      const created = await this.prismaService.submission.create({
        data: {
          content,
          description,
          user: {
            connect: { id: userId },
          },
          competition: {
            connect: { id: competitionId },
          },
        },
      });
      return created;
    } catch (e) {
      return {
        error: e,
        message: 'record invalid',
      };
    }
  }

  @Post(':id/rating')
  async createRating(
    @Param('id') id: string,

    @Body()
    ratingData: {
      feedback: string;
      userId: number;
      rating: number;
    },
  ): Promise<any> {
    const { feedback, userId, rating } = ratingData;
    const createRating = this.prismaService.rating.create({
      data: {
        feedback,
        userId,
        submissionId: Number(id),
        rating,
      },
    });

    const updateSubmissionRating = this.prismaService.submission.update({
      where: { id: Number(id) },
      data: {
        rating: await getSubmissionRating(id, rating),
      },
    });

    return await this.prismaService.$transaction([
      createRating,
      updateSubmissionRating,
    ]);
  }

  @Delete(':id')
  async deleteSubmission(
    @Param('id') id: string,
  ): Promise<[object, SubmissionModel]> {
    const deleteRating = this.prismaService.rating.deleteMany({
      where: {
        submissionId: Number(id),
      },
    });

    const deleteSubmissions = this.prismaService.submission.delete({
      where: {
        id: Number(id),
      },
    });

    return await this.prismaService.$transaction([
      deleteRating,
      deleteSubmissions,
    ]);
  }
}
