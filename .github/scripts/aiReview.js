import { Octokit } from "@octokit/rest";
import { Configuration, OpenAIApi } from "openai";

(async () => {
  try {
    const token = process.env.GITHUB_TOKEN;
    const openAiKey = process.env.OPENAI_API_KEY;
    const repoOwner = process.env.GITHUB_REPOSITORY.split("/")[0];
    const repoName = process.env.GITHUB_REPOSITORY.split("/")[1];
    const issueNumber = process.env.ISSUE_NUMBER;

    // build Octokit instance
    const octokit = new Octokit({ auth: token });

    // get Issue details
    const { data: issue } = await octokit.rest.issues.get({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
    });

    const issueTitle = issue.title;
    const issueBody = issue.body;

    // build prompt
    // TODO: 別ファイルで管理する。
    const guideline = `
あなたは issue レビューのエキスパートです。以下のガイドラインに基づいて、
issue の内容（タイトル、本文）に対する評価・改善点を出力してください。

【ガイドライン要約】
  1. 問題/目的が明確であるか？
    - 読んだだけで大体の内容が分かるような簡潔なタイトルが設定されているか。
    - 「なにが問題なのか」「なにを解決したいのか」が簡潔に設定されているか。
  1. 再現手順/環境情報が具体的であるか？
    - 「ある画面でボタンを押す → エラーが起きる」というように、誰でも同じ条件で問題を再現できるように手順が記載されているか。
    - OS、ブラウザ、ライブラリバージョンなど、問題が起きた際の環境が明記されているか。
  1. 期待する結果・実際の結果が明示されているか？
    - 「本来こうあるはず」と思っている結果を明確に記載されているか。
    - 実際には何が起きたのか、が正確に記載されているか。
  1. （Optional）スクリーンショット・ログが必要に応じて添付されているか？
  1. （Optional）既存の issue, PR にリンクされているか？
`;

    const prompt = `
以下のIssueを読み、上記のガイドラインを踏まえたレビューを行ってください。
Issueタイトル: ${issueTitle}
Issue本文:
${issueBody}
`;

    const configuration = new Configuration({
      apiKey: openAiKey, // これが OPENAI_API_KEY
    });
    const openai = new OpenAIApi(configuration);
    const modelName = "gpt-4o-mini";

    const response = await openai.createChatCompletion({
      model: modelName,
      messages: [
        { role: "system", content: guideline },
        { role: "user", content: prompt }
      ],
      temperature: 0.0,
    });

    const reviewMessage = response.data.choices[0]?.message?.content ?? "";

    await octokit.rest.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
      body: `## AI レビュー結果\n\n${reviewMessage}`,
    });

    console.log("AI Review completed and commented successfully.");
  } catch (error) {
    console.error("Error while reviewing issue:", error);
    process.exit(1);
  }
})();
