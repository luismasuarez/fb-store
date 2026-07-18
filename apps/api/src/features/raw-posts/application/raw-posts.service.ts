import { Injectable, NotFoundException } from "@nestjs/common";
import { RawPostRepository } from "../infrastructure/raw-post.repository";
import type { RawPostsQuery } from "../infrastructure/raw-post.repository";
import { wrapSuccessList, wrapSuccessItem } from "../../../common/dto/api-response";

@Injectable()
export class RawPostsService {
  constructor(private readonly rawPostRepository: RawPostRepository) {}

  async findAll(params: RawPostsQuery) {
    const { data, total } = await this.rawPostRepository.findAll(params);
    return wrapSuccessList(data, {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    });
  }

  async findOne(id: string) {
    const post = await this.rawPostRepository.findById(id);
    if (!post) {
      throw new NotFoundException(`RawPost ${id} not found`);
    }
    return wrapSuccessItem(post);
  }
}
