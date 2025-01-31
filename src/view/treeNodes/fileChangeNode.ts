/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { DiffHunk, DiffChangeType } from '../../common/diffHunk';
import { GitChangeType } from '../../common/file';
import { TreeNode } from './treeNode';
import { IComment } from '../../common/comment';
import { getDiffLineByPosition, getZeroBased } from '../../common/diffPositionMapping';
import { toResourceUri } from '../../common/uri';
import { PullRequestModel } from '../../github/pullRequestModel';

/**
 * File change node whose content can not be resolved locally and we direct users to GitHub.
 */
export class RemoteFileChangeNode extends TreeNode implements vscode.TreeItem {
	public label: string;
	public description: string;
	public iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon;
	public command: vscode.Command;
	public resourceUri: vscode.Uri;

	constructor(
		public readonly parent: TreeNode | vscode.TreeView<TreeNode>,
		public readonly pullRequest: PullRequestModel,
		public readonly status: GitChangeType,
		public readonly fileName: string,
		public readonly blobUrl: string
	) {
		super();
		this.label = path.basename(fileName);
		this.description = path.relative('.', path.dirname(fileName));
		this.iconPath = vscode.ThemeIcon.File;
		this.resourceUri = toResourceUri(vscode.Uri.parse(this.blobUrl), false, status);

		this.command = {
			title: 'show remote file',
			command: 'pr.openDiffGitHub',
			arguments: [
				vscode.Uri.parse(this.blobUrl)
			]
		};
	}

	getTreeItem(): vscode.TreeItem {
		return this;
	}
}

/**
 * File change node whose content is stored in memory and resolved when being revealed.
 */
export class InMemFileChangeNode extends TreeNode implements vscode.TreeItem {
	public label: string;
	public description: string;
	public iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon;
	public resourceUri: vscode.Uri;
	public parentSha: string;
	public contextValue: string;
	public command: vscode.Command;
	public opts: vscode.TextDocumentShowOptions;

	constructor(
		public readonly parent: TreeNode | vscode.TreeView<TreeNode>,
		public readonly pullRequest: PullRequestModel,
		public readonly status: GitChangeType,
		public readonly fileName: string,
		public readonly previousFileName: string | undefined,
		public readonly blobUrl: string,
		public readonly filePath: vscode.Uri,
		public readonly parentFilePath: vscode.Uri,
		public readonly isPartial: boolean,
		public readonly patch: string,
		public readonly diffHunks: DiffHunk[],
		public comments: IComment[],
		public readonly sha?: string
	) {
		super();
		this.contextValue = `filechange:${GitChangeType[status]}`;
		this.label = path.basename(fileName);
		this.description = path.relative('.', path.dirname(fileName));
		this.iconPath = vscode.ThemeIcon.File;
		this.opts = {
			preserveFocus: true
		};
		this.update(this.comments);
	}

	update(comments: IComment[]) {
		this.resourceUri = toResourceUri(this.filePath, comments.length > 0, this.status);

		if (comments && comments.length) {
			const sortedActiveComments = comments.filter(comment => comment.position).sort((a, b) => {
				return a.position! - b.position!;
			});

			if (sortedActiveComments.length) {
				const comment = sortedActiveComments[0];
				const diffLine = getDiffLineByPosition(this.diffHunks, comment.position === undefined ? comment.originalPosition! : comment.position);

				if (diffLine) {
					// If the diff is a deletion, the new line number is invalid so use the old line number. Ensure the line number is positive.
					const lineNumber = Math.max(getZeroBased(diffLine.type === DiffChangeType.Delete ? diffLine.oldLineNumber : diffLine.newLineNumber), 0);
					this.opts.selection = new vscode.Range(lineNumber, 0, lineNumber, 0);
				}
			}
		}

		this.command = {
			title: 'show diff',
			command: 'pr.openDiffView',
			arguments: [ this ]
		};
	}

	getCommentPosition(comment: IComment) {
		const diffLine = getDiffLineByPosition(this.diffHunks, comment.position === undefined ? comment.originalPosition! : comment.position);

		if (diffLine) {
			// If the diff is a deletion, the new line number is invalid so use the old line number. Ensure the line number is positive.
			const lineNumber = Math.max(getZeroBased(diffLine.type === DiffChangeType.Delete ? diffLine.oldLineNumber : diffLine.newLineNumber), 0);
			return lineNumber;
		}

		return 0;
	}

	getTreeItem(): vscode.TreeItem {
		return this;
	}
}

/**
 * File change node whose content can be resolved by git commit sha.
 */
export class GitFileChangeNode extends TreeNode implements vscode.TreeItem {
	public label: string;
	public description: string;
	public iconPath?: string | vscode.Uri | { light: string | vscode.Uri; dark: string | vscode.Uri } | vscode.ThemeIcon;
	public resourceUri: vscode.Uri;
	public parentSha: string;
	public contextValue: string;
	public command: vscode.Command;
	public opts: vscode.TextDocumentShowOptions;

	constructor(
		public readonly parent: TreeNode | vscode.TreeView<TreeNode>,
		public readonly pullRequest: PullRequestModel,
		public readonly status: GitChangeType,
		public readonly fileName: string,
		public readonly blobUrl: string | undefined,
		public readonly filePath: vscode.Uri,
		public readonly parentFilePath: vscode.Uri,
		public readonly isPartial: boolean,
		public readonly diffHunks: DiffHunk[],
		public comments: IComment[] = [],
		public readonly sha?: string,
	) {
		super();
		this.contextValue = `filechange:${GitChangeType[status]}`;
		this.label = path.basename(fileName);
		this.description = path.relative('.', path.dirname(fileName));
		this.iconPath = vscode.ThemeIcon.File;
		this.resourceUri = toResourceUri(this.filePath, comments.length > 0, status);

		this.opts = {
			preserveFocus: true
		};

		if (this.comments && this.comments.length) {
			const sortedActiveComments = this.comments.filter(comment => comment.position).sort((a, b) => {
				return a.position! - b.position!;
			});

			if (sortedActiveComments.length) {
				const comment = sortedActiveComments[0];
				const diffLine = getDiffLineByPosition(this.diffHunks, comment.position === undefined ? comment.originalPosition! : comment.position);

				if (diffLine) {
					// If the diff is a deletion, the new line number is invalid so use the old line number. Ensure the line number is positive.
					const lineNumber = Math.max(getZeroBased(diffLine.type === DiffChangeType.Delete ? diffLine.oldLineNumber : diffLine.newLineNumber), 0);
					this.opts.selection = new vscode.Range(lineNumber, 0, lineNumber, 0);
				}
			}
		}

		this.command = {
			title: 'open changed file',
			command: 'pr.openChangedFile',
			arguments: [this]
		};
	}

	getCommentPosition(comment: IComment) {
		const diffLine = getDiffLineByPosition(this.diffHunks, comment.position === undefined ? comment.originalPosition! : comment.position!);

		if (diffLine) {
			// If the diff is a deletion, the new line number is invalid so use the old line number. Ensure the line number is positive.
			const lineNumber = Math.max(getZeroBased(diffLine.type === DiffChangeType.Delete ? diffLine.oldLineNumber : diffLine.newLineNumber), 0);
			return lineNumber;
		}

		return 0;
	}

	getTreeItem(): vscode.TreeItem {
		return this;
	}
}

export function gitFileChangeNodeFilter(nodes: (GitFileChangeNode | RemoteFileChangeNode)[]): GitFileChangeNode[] {
	return nodes.filter(node => node instanceof GitFileChangeNode) as GitFileChangeNode[];
}