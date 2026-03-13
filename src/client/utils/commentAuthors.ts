type CommentAuthorLike = {
  author?: string;
};

export function getUniqueCommentAuthors(comments: CommentAuthorLike[]): string[] {
  const authors = new Set<string>();

  comments.forEach((comment) => {
    const normalizedAuthor = comment.author?.trim();
    if (normalizedAuthor) {
      authors.add(normalizedAuthor);
    }
  });

  return [...authors];
}

export function hasMultipleCommentAuthors(comments: CommentAuthorLike[]): boolean {
  return getUniqueCommentAuthors(comments).length >= 2;
}
