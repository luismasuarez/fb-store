import { BadRequestException, ArgumentMetadata } from "@nestjs/common";
import { z } from "zod/v4";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe();
  });

  it("returns value when no schema provided", () => {
    const metadata: ArgumentMetadata = {
      type: "query",
      metatype: undefined as any,
      data: "page",
    };
    expect(pipe.transform("test", metadata)).toBe("test");
  });

  it("returns value when metatype has no safeParse", () => {
    const metadata: ArgumentMetadata = {
      type: "query",
      metatype: class Foo {} as any,
      data: "page",
    };
    expect(pipe.transform("test", metadata)).toBe("test");
  });

  it("passes valid data through", () => {
    const schema = z.object({ name: z.string() });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: schema as any,
      data: undefined,
    };
    const result = pipe.transform({ name: "test" }, metadata);
    expect(result).toEqual({ name: "test" });
  });

  it("strips unknown fields (whitelist)", () => {
    const schema = z.object({ name: z.string() });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: schema as any,
      data: undefined,
    };
    const result = pipe.transform({ name: "test", extra: "should-strip" }, metadata);
    expect(result).toEqual({ name: "test" });
  });

  it("coerces types", () => {
    const schema = z.object({ age: z.coerce.number() });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: schema as any,
      data: undefined,
    };
    const result = pipe.transform({ age: "42" }, metadata);
    expect(result).toEqual({ age: 42 });
  });

  it("throws BadRequestException on invalid data", () => {
    const schema = z.object({ name: z.string().min(3) });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: schema as any,
      data: undefined,
    };
    expect(() => pipe.transform({ name: "ab" }, metadata)).toThrow(
      BadRequestException,
    );
  });

  it("formats error with path and message", () => {
    const schema = z.object({ age: z.number().min(18) });
    const metadata: ArgumentMetadata = {
      type: "body",
      metatype: schema as any,
      data: undefined,
    };
    try {
      pipe.transform({ age: 15 }, metadata);
    } catch (e: any) {
      expect(e.response.message).toBe("Validation failed");
      expect(e.response.errors).toEqual([
        { path: "age", message: expect.any(String) },
      ]);
    }
  });
});
