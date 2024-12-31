import { Octokit } from "@octokit/rest"; // npm install @octokit/rest

(async () => {
  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const openAiKey = process.env.OPENAI_API_KEY;

    const repoOwner = process.env.GITHUB_REPOSITORY.split("/")[0];
    const repoName = process.env.GITHUB_REPOSITORY.split("/")[1];
    const issueNumber = process.env.ISSUE_NUMBER; // Actions の env 等で指定

    const octokit = new Octokit({ auth: githubToken });
    const { data: issue } = await octokit.rest.issues.get({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
    });

    const issueTitle = issue.title;
    const issueBody = issue.body;

    const guideline = `
あなたは issue レビューのエキスパートです。以下のガイドラインに基づいて、
issue の内容（タイトル、本文）に対する評価・改善点を出力してください。

【ガイドライン要約】
  1. 問題/目的が明確であるか？
    - 「なにが問題なのか」「なにを解決したいのか」が簡潔に設定されているか？
  2. 再現手順/環境情報が具体的か？
    - 誰でも同じ条件で問題を再現できるように手順や環境が書かれているか？
  3. 期待する結果・実際の結果が明示されているか？
    - 何が起きるはずで、実際には何が起きているのかが明記されているか？
  4. （Optional）スクリーンショット・ログが必要に応じて添付されているか？
  5. （Optional）既存の issue, PR にリンクされているか？
`;

    const prompt = `
以下のIssueを読み、上記のガイドラインを踏まえたレビューを行ってください。
Issueタイトル: ${issueTitle}
Issue本文:
${issueBody}
`;

    const endpoint = "https://api.openai.com/v1/chat/completions";
    const requestBody = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: guideline },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    const reviewMessage = data?.choices?.[0]?.message?.content ?? "";

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
