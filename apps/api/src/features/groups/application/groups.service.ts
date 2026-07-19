import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { GroupRepository } from "../infrastructure/group.repository";
import type { CreateGroupDto } from "../api/dto/create-group.dto";
import type { UpdateGroupDto } from "../api/dto/update-group.dto";

@Injectable()
export class GroupsService {
  constructor(private readonly repo: GroupRepository) {}

  async findAll(page = 1, limit = 20) {
    const { data, total } = await this.repo.findAll(page, limit);
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const group = await this.repo.findById(id);
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    return { data: group };
  }

  async create(dto: CreateGroupDto) {
    if (dto.url) {
      const existing = await this.repo.findByUrl(dto.url);
      if (existing) {
        throw new ConflictException("A group with this URL already exists");
      }
    }
    const group = await this.repo.create(dto);
    return { data: group };
  }

  async update(id: string, dto: UpdateGroupDto) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException("Group not found");
    }

    if (dto.url && dto.url !== existing.url) {
      const urlExists = await this.repo.findByUrl(dto.url);
      if (urlExists && urlExists.id !== id) {
        throw new ConflictException("A group with this URL already exists");
      }
    }

    const updated = await this.repo.update(id, dto);
    return { data: updated };
  }

  async delete(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException("Group not found");
    }
    await this.repo.delete(id);
    return { message: "Group deleted" };
  }
}
