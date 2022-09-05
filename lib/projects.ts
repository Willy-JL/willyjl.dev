import emojiRegex from 'emoji-regex';
import { log } from 'next-axiom';

import type { GitHubRepos, Project, ProjectPost } from '~/types';

/**
 * Fetch Projects
 *
 * Make a GET request to the GitHub API to gather all repositories
 * under my `nurodev` username & then filter them down to only
 * include those that contain the `portfolio` topic
 *
 * @TODO Switch to v3 API using GraphQL to save over-fetching
 */
export async function fetchProjects(): Promise<Array<Project> | null> {
	let json: GitHubRepos = [];
	let page = 1;
	while (true) {
		const response = await fetch(`https://api.github.com/users/nurodev/repos?per_page=100&page=${page}`, {
			headers: {
				...(process.env.GITHUB_PAT && {
					authorization: `token ${process.env.GITHUB_PAT}`,
				}),
			},
		});

		const res = await response.json();

		if (response.status !== 200) {
			const error = res as {
				documentation_url: string;
				message: string;
			};

			console.error({ error });
			log.error('Failed to fetch projects', { error });

			return null;
		}

		if (res.length === 0) break;
		json = json.concat(res as GitHubRepos);
		page += 1;
	}

	const { default: rawProjectPosts } = await import('~/data/projects.json');
	const projectPosts = rawProjectPosts as Array<ProjectPost>;

	const projects: Array<Project> = json
		.map((repo) => {
			if (!repo.topics.includes('portfolio')) return null;

			if (repo.archived) return null;

			// Strip the emoji suffix from the repo description
			const trimmedDescription = repo.description.split(' ');
			trimmedDescription.shift();
			const description = trimmedDescription.join(' ');

			// Check if there is a matching blog post to attach
			const repoPost =
				projectPosts.length > 0 &&
				projectPosts.find(
					(post) => post.repository.toLowerCase() === repo.full_name.toLowerCase(),
				);

			return {
				description,
				icon: (() => {
					if (!repo.description) return undefined;

					const char = repo.description.split(' ')[0];

					return emojiRegex().test(char) ? char : undefined;
				})(),
				homepage: repo.homepage ?? undefined,
				name: repo.name,
				post: repoPost ? `/blog/${repoPost.post}` : undefined,
				template: false,
				url: repo.html_url.toLowerCase(),
			} as Project;
		})
		.filter((project) => project !== null);

	return projects;
}
