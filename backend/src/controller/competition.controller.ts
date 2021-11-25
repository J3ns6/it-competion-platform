import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  Competition as CompetitionModel,
  Submission as SubmissionModel,
  Participants as ParticipantsModel,
  User as UserModel
} from '@prisma/client';
import { skip } from 'rxjs';

@Controller('competitions')
export class CompetitionController {
  constructor(private readonly prismaService: PrismaService) {}

  @Get()
  async getAllCompetitions(): Promise<CompetitionModel[]> {
    return this.prismaService.competition.findMany();
  }

  @Get(':id')
  async getCompetitionById(@Param('id') id: string): Promise<CompetitionModel> {
    return this.prismaService.competition.findUnique({
      where: { id: Number(id) },
    });
  }

  @Get(':id/submissions')
  async getSubmissionsByCompetition(
    @Param('id') id: string,
    @Body()
    settings: {
      skip: number;
      take: number;
      order: string;
    },
  ): Promise<SubmissionModel[]> {
    const { skip, take, order } = settings;
    return await this.prismaService.submission.findMany({
      skip,
      take,
      where: {
        competitionId: Number(id),
      },

      orderBy: [
        order === 'votes'
          ? {
              rating: 'desc',
            }
          : {
              createdAt: 'desc',
            },
      ],
    });
  }

  @Put(':id')
  async updateCompetition(
    @Param('id') id: string,
    @Body()
    competitionData: {
      title: string;
      description: string;
      startDate: number[];
      endDate: number[];
    },
  ): Promise<CompetitionModel> {
    const { title, description, startDate, endDate } = competitionData;
    return this.prismaService.competition.update({
      where: { id: Number(id) },
      data: {
        title,
        description,
        startDate: new Date(startDate[0], startDate[1], startDate[2]),
        endDate: new Date(endDate[0], endDate[1], endDate[2]),
      },
    });
  }

  @Post()
  async createCompetition(
    @Body()
    competitionData: {
        title: string;
        type: string;
        description: string;
        rules: string,
        instructions: string,
        userId: number;
      startDate: number[];
      endDate: number[];
    },
  ): Promise<CompetitionModel | object> {
    const { title, type, description, rules, instructions, userId, startDate, endDate } = competitionData;

    const user: UserModel =
      await this.prismaService.user.findUnique({
        where: {
          id: userId,
        },
      });
    
    if (user === null) {
      return {
        message: 'user does not exits.'
      }
    }
    

    if (user.judge) {
      return this.prismaService.competition.create({
        data: {
          title,
          type,
          description,
          rules,
          instructions,
          creator: {
            connect: { id: userId },
          },
          startDate: new Date(startDate[0], startDate[1], startDate[2]),
          endDate: new Date(endDate[0], endDate[1], endDate[2]),
        },
      });
    } else {
      return {
        errorCode: '',
        info: 'This user is not authorised to create a new competition.',
      };
    }
  }

  // @Post(':id/participants')
  // async addParticipants(@Param('id') id: string, @Body participantData: {
  //   userId,
  //   competitionId
  // }): Promise<ParticipantsModel> {

  // }

  @Delete(':id')
  async deleteCompetition(
    @Param('id') id: string,
  ): Promise<[object, object, CompetitionModel] | object> {
    const submissions = await this.prismaService.submission.findMany({
      where: {
        competitionId: Number(id),
      },
    });

    let deleteRating;
    let deleteSubmissions;

    if (submissions.length !== 0) {
      for (let i = 0; i < submissions.length; i++) {
        if (submissions[i] === undefined) {
          skip;
        }
        deleteRating = this.prismaService.rating.deleteMany({
          where: {
            submissionId: submissions[i].id,
          },
        });
        deleteSubmissions = this.prismaService.submission.deleteMany({
          where: {
            competitionId: Number(id),
          },
        });
      }


      if (submissions.length === 0) {
        return await this.prismaService.competition.delete({
          where: {
            id: Number(id),
          },
        })
      }

      const deleteCompetition = await this.prismaService.competition.delete({
        where: {
          id: Number(id),
        },
      });

      if (submissions.length === 0) {
        return deleteCompetition;
      } else {
        return await this.prismaService.$transaction([
          deleteRating,
          deleteSubmissions,
          deleteCompetition,
        ]);
      }
    }
  }
}
