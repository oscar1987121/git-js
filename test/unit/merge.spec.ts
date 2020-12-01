import { MergeResult, SimpleGit } from 'typings';
import { assertExecutedCommands, assertGitResponseError, like, newSimpleGit } from './__fixtures__';
import { MergeSummaryDetail } from '../../src/lib/responses/MergeSummary';
import { parseMergeResult } from '../../src/lib/parsers/parse-merge';

const {restore, closeWithSuccess, closeWithError} = require('./include/setup');

describe('merge', () => {

   afterEach(() => restore());

   describe('api', () => {

      let git: SimpleGit;

      beforeEach(() => git = newSimpleGit());

      it('merge', () => new Promise(done => {
         git.merge(['--no-ff', 'someOther-master'], () => {
            assertExecutedCommands('merge', '--no-ff', 'someOther-master')
            done();
         });

         closeWithSuccess();
      }));

      it('mergeFromTo', () => new Promise(done => {
         git.mergeFromTo('aaa', 'bbb', () => {
            assertExecutedCommands('merge', 'aaa', 'bbb')
            done();
         });

         closeWithSuccess();
      }));

      it('mergeFromToWithOptions', () => new Promise(done => {
         git.mergeFromTo('aaa', 'bbb', ['x', 'y'], () => {
            assertExecutedCommands('merge', 'aaa', 'bbb', 'x', 'y')
            done();
         });

         closeWithSuccess();
      }));

      it('mergeFromToWithBadOptions', () => new Promise(done => {
         (git as any).mergeFromTo('aaa', 'bbb', 'x', () => {
            assertExecutedCommands('merge', 'aaa', 'bbb')
            done();
         });

         closeWithSuccess();
      }));

      it('merge with fatal error', () => new Promise(done => {
         git.mergeFromTo('aaa', 'bbb', 'x' as any, (err: null | Error) => {
            expect(err?.message).toBe('Some fatal error');
            done();
         });
         closeWithError('Some fatal error', 128);
      }));

      it('merge with conflicts treated as an error', () => new Promise(done => {
         git.mergeFromTo('aaa', 'bbb', 'x' as any, (err: null | Error) => {

            assertGitResponseError(err, MergeSummaryDetail, like({failed: true}))
            done();
         });

         closeWithSuccess(`
Auto-merging readme.md
CONFLICT (content): Merge conflict in readme.md
Automatic merge failed; fix conflicts and then commit the result.
`);
      }));
   });

   describe('parser', () => {

      let mergeSummary: MergeResult;

      it('successful merge with some files updated', () => {
         givenTheResponse(`
Updating 5826641..52c5cc6
Fast-forward
 aaa.aaa | 2 +-
 ccc.ccc | 1 +
 50 files changed, 20 insertions(+), 1 deletion(-)
 create mode 100644 ccc.ccc
`);
         expect(mergeSummary).toEqual(
            expect.objectContaining({
               failed: false,
               conflicts: [],
               merges: [],
               summary: {
                  changes: 50,
                  insertions: 20,
                  deletions: 1,
               }
            })
         );
      });

      it('multiple merges with some conflicts and some success', () => {
         givenTheResponse(`
Auto-merging ccc.ccc
CONFLICT (add/add): Merge conflict in ccc.ccc
Auto-merging bbb.bbb
Auto-merging aaa.aaa
CONFLICT (content): Merge conflict in aaa.aaa
Automatic merge failed; fix conflicts and then commit the result.
`);

         expect(mergeSummary).toEqual(
            expect.objectContaining({
               failed: true,
               conflicts: [
                  {reason: 'add/add', file: 'ccc.ccc'},
                  {reason: 'content', file: 'aaa.aaa'},
               ],
               merges: [
                  'ccc.ccc',
                  'bbb.bbb',
                  'aaa.aaa'
               ],
            })
         );
      });

      it('names conflicts when they exist', () => {
         givenTheResponse(`
Auto-merging readme.md
CONFLICT (content): Merge conflict in readme.md
Automatic merge failed; fix conflicts and then commit the result.
`);

         expect(mergeSummary.failed).toBe(true);
         expect(mergeSummary.conflicts).toEqual([
            {reason: 'content', file: 'readme.md'}
         ]);
      });

      it('names modify/delete conflicts when deleted by them', () => {
         givenTheResponse(`
Auto-merging readme.md
CONFLICT (modify/delete): readme.md deleted in origin/master and modified in HEAD. Version HEAD of readme.md left in tree.
Automatic merge failed; fix conflicts and then commit the result.
`);
         expect(mergeSummary.failed).toBe(true);
         expect(mergeSummary.conflicts).toEqual([
            {
               reason: 'modify/delete',
               file: 'readme.md',
               meta: {deleteRef: 'origin/master'}
            }
         ]);
      });

      it('names modify/delete conflicts when deleted by us', () => {
         givenTheResponse(`
Auto-merging readme.md
CONFLICT (modify/delete): readme.md deleted in HEAD and modified in origin/master. Version origin/master of readme.md left in tree.
Automatic merge failed; fix conflicts and then commit the result.
`);
         expect(mergeSummary.failed).toBe(true);
         expect(mergeSummary.conflicts).toEqual([
            {
               reason: 'modify/delete',
               file: 'readme.md',
               meta: {deleteRef: 'HEAD'}
            }
         ]);
      });

      function givenTheResponse(stdOut: string, stdErr = '') {
         return mergeSummary = parseMergeResult(stdOut, stdErr);
      }

   });

})