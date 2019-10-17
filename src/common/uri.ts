/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Uri, UriHandler, EventEmitter } from 'vscode';
import { GitChangeType } from './file';
import { PullRequestModel } from '../github/pullRequestModel';
import { Repository } from '../api/api';
import * as path from 'path';

export interface ReviewUriParams {
	path: string;
	ref?: string;
	commit?: string;
	base: boolean;
	isOutdated: boolean;
}

export function fromReviewUri(uri: Uri): ReviewUriParams {
	return JSON.parse(uri.query);
}

export interface PRUriParams {
	baseCommit: string;
	headCommit: string;
	isBase: boolean;
	fileName: string;
	prNumber: number;
	status: GitChangeType;
	remoteName: string;
}

export function fromPRUri(uri: Uri): PRUriParams | undefined {
	try {
		return JSON.parse(uri.query) as PRUriParams;
	} catch (e) { }
}

export interface GitUriOptions {
	replaceFileExtension?: boolean;
	submoduleOf?: string;
	base: boolean;
}

const ImageMimetypes = [
	'image/png',
	'image/gif',
	'image/jpeg',
	'image/webp',
	'image/tiff',
	'image/bmp'
];

export async function asImageDataURI(uri: Uri, repository: Repository): Promise<Uri | undefined> {
	try {
		const { commit } = JSON.parse(uri.query);
		const { size, object } = await repository.getObjectDetails(commit, uri.fsPath);
		const { mimetype } = await repository.detectObjectType(object);

		if (mimetype === 'text/plain') {
			return;
		}

		if (ImageMimetypes.indexOf(mimetype) > -1) {
			const contents = await repository.buffer(commit, uri.fsPath);
			return Uri.parse(`data:${mimetype};label:${path.basename(uri.fsPath)};description:${commit};size:${size};base64,${contents.toString('base64')}`);
		}
	} catch (err) {
		return;
	}
}

export function toReviewUri(uri: Uri, filePath: string | undefined, ref: string | undefined, commit: string, isOutdated: boolean, options: GitUriOptions): Uri {
	const params: ReviewUriParams = {
		path: filePath ? filePath : uri.path,
		ref,
		commit: commit,
		base: options.base,
		isOutdated
	};

	let path = uri.path;

	if (options.replaceFileExtension) {
		path = `${path}.git`;
	}

	return uri.with({
		scheme: 'review',
		path,
		query: JSON.stringify(params)
	});
}

export interface FileChangeNodeUriParams {
	hasComments?: boolean;
	status?: GitChangeType;
}

export function toResourceUri(uri: Uri, hasComments: boolean, status: GitChangeType) {
	const params = {
		hasComments: hasComments,
		status: status
	};

	return uri.with({
		query: JSON.stringify(params)
	});
}

export function fromFileChangeNodeUri(uri: Uri): FileChangeNodeUriParams | undefined {
	try {
		return JSON.parse(uri.query) as FileChangeNodeUriParams;
	} catch (e) { }
}

export function toPRUri(uri: Uri, pullRequestModel: PullRequestModel, baseCommit: string, headCommit: string, fileName: string, base: boolean, status: GitChangeType): Uri {
	const params: PRUriParams = {
		baseCommit: baseCommit,
		headCommit: headCommit,
		isBase: base,
		fileName: fileName,
		prNumber: pullRequestModel.prNumber,
		status: status,
		remoteName: pullRequestModel.githubRepository.remote.remoteName
	};

	const path = uri.path;

	return uri.with({
		scheme: 'pr',
		path,
		query: JSON.stringify(params)
	});
}

class UriEventHandler extends EventEmitter<Uri> implements UriHandler {
	public handleUri(uri: Uri) {
		this.fire(uri);
	}
}

export const handler = new UriEventHandler;